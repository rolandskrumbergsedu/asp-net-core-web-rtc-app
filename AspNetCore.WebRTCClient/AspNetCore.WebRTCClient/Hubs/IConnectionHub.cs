using AspNetCore.WebRTCClient.Hubs.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AspNetCore.WebRTCClient.Hubs
{
    public interface IConnectionHub
    {
        Task UpdateUserList(List<User> users);
        Task CallEnded(User callingUser, string v);
        Task CallDeclined(User targetUserFromConnection, string v);
        Task IncomingCall(User callingUser);
        Task CallAccepted(User callingUser);
        Task ReceiveSignal(User callingUser, string signal);
    }
}
