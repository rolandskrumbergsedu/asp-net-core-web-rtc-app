using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AspNetCore.WebRTCClient.Hubs.Models
{
    public class CallOffer
    {
        public User Caller { get; set; }
        public User Callee { get; set; }
    }
}
