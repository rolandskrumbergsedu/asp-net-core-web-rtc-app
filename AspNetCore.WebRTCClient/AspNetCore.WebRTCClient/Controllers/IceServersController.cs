using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using Twilio.Types;

namespace AspNetCore.WebRTCClient.Controllers
{
    [ApiController]
    [Route("api/{controller}")]
    public class IceServersController : ControllerBase
    {
        public ActionResult<List<IceServer>> GetIceServers()
        {
            const string accountSid = "AC9202a1e5936791dfd6813e4b52ff3ad1";
            const string authToken = "410134e9dff2193a2d0e471e44d1c8eb";

            TwilioClient.Init(accountSid, authToken);
            var token = TokenResource.Create();

            return token.IceServers;
        }
    }
}
