using AspNetCore.WebRTCClient.Hubs.Models;
using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Threading.Tasks;

namespace AspNetCore.WebRTCClient.Hubs
{
    public class ConnectionHub : Hub<IConnectionHub>
    {
        private readonly List<User> _users;
        private readonly List<UserCall> _userCalls;
        private readonly List<CallOffer> _callOffers;

        public ConnectionHub(List<User> users, List<UserCall> userCalls, List<CallOffer> callOffers)
        {
            _users = users;
            _userCalls = userCalls;
            _callOffers = callOffers;
        }

        public async Task Join(string username)
        {
            // Add new user
            _users.Add(new User
            {
                Username = username,
                ConnectionId = Context.ConnectionId
            });

            // Send new list to all users
            await SendUserListUpdate();
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            // Hang up any call the user is in
            await HangUp();

            _users.RemoveAll(user => user.ConnectionId == Context.ConnectionId);

            await SendUserListUpdate();

            await base.OnDisconnectedAsync(exception);
        }

        public async Task HangUp()
        {
            var callingUser = _users
                .SingleOrDefault(user => user.ConnectionId == Context.ConnectionId);

            if (callingUser == null)
            {
                return;
            }

            var currentCall = GetUserCall(callingUser.ConnectionId);

            // Send hang up message to each user in the call, if there is one
            if (currentCall != null)
            {
                var currentCallUsers = currentCall.Users
                    .Where(user => user.ConnectionId != callingUser.ConnectionId);

                foreach (var user in currentCallUsers)
                {
                    await Clients.Client(user.ConnectionId)
                        .CallEnded(callingUser, $"{callingUser.Username} has hang up.");
                }
            }

            // Remove call from the list if there is only one (or none) person left.
            // This should always trigger now, but will be useful when we implement conferencing.
            currentCall.Users.RemoveAll(user => user.ConnectionId == callingUser.ConnectionId);
            if (currentCall.Users.Count < 2)
            {
                _userCalls.Remove(currentCall);
            }

            // Remove all offers initiating from the caller
            _callOffers.RemoveAll(callOffers => callOffers.Caller.ConnectionId == callingUser.ConnectionId);

            await SendUserListUpdate();
        }

        public async Task CallUser(User targetUserFromConnection)
        {
            var callingUser = _users
                .SingleOrDefault(user => user.ConnectionId == Context.ConnectionId);
            var targetUser = _users
                .SingleOrDefault(user => user.ConnectionId == targetUserFromConnection.ConnectionId);

            if (targetUser == null)
            {
                await Clients.Caller
                    .CallDeclined(targetUserFromConnection, $"{targetUser.Username} is not available.");
            }

            if (GetUserCall(targetUser.ConnectionId) != null)
            {
                await Clients.Caller
                    .CallDeclined(targetUserFromConnection, $"{targetUser.Username} is not other call.");
                return;
            }

            // Send info that somebody wants to talk
            await Clients.Client(targetUserFromConnection.ConnectionId)
                .IncomingCall(callingUser);

            _callOffers.Add(new CallOffer
            {
                Caller = callingUser,
                Callee = targetUser
            });
        }

        public async Task AnswerCall(bool acceptCall, User targetUserFromConnection)
        {
            var callingUser = _users
               .SingleOrDefault(user => user.ConnectionId == Context.ConnectionId);
            var targetUser = _users
                .SingleOrDefault(user => user.ConnectionId == targetUserFromConnection.ConnectionId);

            // This can only happen if server side went down and clients were cleared
            // while user still held their browser session
            if (callingUser == null)
            {
                return;
            }

            // Make sure the original caller has not left the page yet
            if (targetUser == null)
            {
                await Clients.Caller.CallEnded(targetUserFromConnection, "The other user in your call has left.");
                return;
            }

            // Send decline message if callee said no
            if (!acceptCall)
            {
                await Clients.Client(targetUserFromConnection.ConnectionId)
                    .CallDeclined(callingUser, $"{callingUser.Username} did not accept your call.");
            }

            // Make sure there is still active offer.
            // If there isn't, then other user hang up before the callee answered.
            var offerCount = _callOffers
                .RemoveAll(c => c.Callee.ConnectionId == callingUser.ConnectionId
                           && c.Caller.ConnectionId == targetUser.ConnectionId);
            if (offerCount <1)
            {
                await Clients.Caller.CallEnded(targetUserFromConnection, $"{targetUser.Username} has already hung up.");
                return;
            }

            // Make sure user has not accepted other calls
            if (GetUserCall(targetUser.ConnectionId) != null)
            {
                await Clients.Caller.CallDeclined(targetUserFromConnection, $"{targetUser.Username} chose to accept someone elses call instad of yours.");
                return;
            }

            // Remove all the other offers for the call initiator, in case they have multiple calls out
            _callOffers.RemoveAll(c => c.Caller.ConnectionId == targetUser.ConnectionId);

            // Create a new call to match these folks
            _userCalls.Add(new UserCall
            {
                Users = new List<User>
                {
                    callingUser, targetUser
                }
            });

            // Tell the original caller that the call was accepted
            await Clients.Client(targetUserFromConnection.ConnectionId)
                .CallAccepted(callingUser);

            await SendUserListUpdate();
        }

        public async Task SendSignal(string signal, string targetConnectionId)
        {
            var callingUser = _users
               .SingleOrDefault(user => user.ConnectionId == Context.ConnectionId);
            var targetUser = _users
                .SingleOrDefault(user => user.ConnectionId == targetConnectionId);

            if (callingUser == null || targetUser == null)
            {
                return;
            }

            // Make sure that the person sending the signal is in a call
            var userCall = GetUserCall(callingUser.ConnectionId);

            // Make sure the target is one they are in a call with
            if (userCall != null && userCall.Users.Exists(u => u.ConnectionId == targetUser.ConnectionId))
            {
                // If they are in a call together, lets them talk Web RTC
                await Clients.Client(targetConnectionId).ReceiveSignal(callingUser, signal);
            }
        }

        private async Task SendUserListUpdate()
        {
            _users.ForEach(user => user.InCall = (GetUserCall(user.ConnectionId) != null));

            await Clients.All.UpdateUserList(_users);
        }

        private UserCall GetUserCall(string connectionId)
        {
            var userCall = _userCalls
                .SingleOrDefault(userCall => userCall.Users
                    .SingleOrDefault(user => user.ConnectionId == connectionId) != null);

            return userCall;
        }
    }
}
