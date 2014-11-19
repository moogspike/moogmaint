#!/usr/bin/env node
var express = require('express');
var http = require('http');
var url = require('url');
var app = express();
var bodyParser= require('/usr/local/lib/node_modules/body-parser');
var auth_token="m00gmaint";
var mmRequests={};
/** 
 * @author Andrew (Spike) Hepburn
 * @file MaintProxy.js
 */

// Create a service (the app object is just a callback).

http.createServer(app).listen(9090);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false } ));

app.post('/completed', function(req,res) {

	console.log("Got a complete for ");
	console.log(req.body);

	if ( req.body ) {
		
		if ( req.body.reqid && req.body.message && req.body.status ) {

			if ( mmRequests[req.body.reqid] ) {

				console.log("Sending a completed");
				var myRes=mmRequests[req.body.reqid];
				myRes.status(req.body.status);
				myRes.send({"message" : req.body.message, statusCode : req.body.status });
				myRes.end();
				mmRequests[req.body.reqid]=null;
			}
		}

	}
	res.status(200);
	res.end();
});

app.post('/maint',function(req,res) {
	console.log("Got a request to forward events");

	// This will do no payload validation, this will simply 
	// enclose the req.body into a REST LAM formatted event
	// with an auth token.

        var maintRequestDetails={};
	var reqUUID="1234-567890";

	if ( auth_token ) {
		maintRequestDetails.auth_token = auth_token;
		req.body.reqUUID=reqUUID;
	}

	if ( req.body && req.body.maintModeData ) {
		maintRequestDetails.events=[];
		maintRequestDetails.events.push(req.body);
	}
	else {
		res.status(400);
		res.send({ "message" : "Payload must contain \"maintModeData\" to be forwarded", "statusCode" : 2001});
		res.end();
	}

        var maintRequestString=JSON.stringify(maintRequestDetails);
	console.log(maintRequestString);

        var maintHeaders = {
                'Accept'        : 'application/json',
                'Content-Type'  : 'application/json',
                'Content-Length': Buffer.byteLength(maintRequestString, 'utf8')
        };

        var maintRequestOpts = {
                host    : "moogdev",
                port    : 9999,
                method  : 'POST',
                headers : maintHeaders,
                rejectUnauthorized      : false
        };

        var maintRequest = http.request(maintRequestOpts, function(maintres) 
	{ 
		var returnString="";
		var requestData;
		var returnStatus=0;
		maintres.on('data', function(d) { 
			returnString += d;
		});
		maintres.on('end', function() {
			returnStatus=res.statusCode || 0;
			if ( returnStatus !== 200 )  {

				console.log("maintRequest: Received an error from the REST LAM ");
				try { 
						requestData=JSON.parse(returnString.toString('utf8')); }
				catch(e) { 
						console.log("maintRequest: Error parsing POST request return data " + e); 
				}

				// See if we have a status code and/or a message to act on.
						
				if ( requestData) {

					if ( typeof requestData.statusCode !== 'undefined' ) {
						console.log("Status code: " + requestData.statusCode);
					}
					if (  typeof requestData.message !== 'undefined' )  {
						console.log("Message: " + requestData.message);
					}
					else {
						console.log("maintRequest: No error message returned for a status of " + returnStatus);
					}
				}
			}
			else {
				try { 
						requestData=JSON.parse(returnString.toString('utf8')); }
				catch(e) { 
						console.log("maintRequest: Error parsing POST request return data " + e); 
				}
				if ( typeof requestData.message !== 'undefined' )  {
					console.log("Message: " + requestData.message);
				}
				mmRequests[reqUUID]=res;
				res.status(202);
				res.send({"message" : "Sent for processing"});
				setTimeout(function(res,reqUUID) {
						console.log("HERE" + reqUUID);
						// console.log(mmRequests);
						console.log(mmRequests[reqUUID]);
						if ( mmRequests[reqUUID] ) {
							console.log("Failed....");
							// The request is still there
							// so no response from the moobot. 
							res.status(400);
							res.send({ "message" : "Failed to get a response before timeout"});
							res.end();
						}
						else {
							console.log("It's not there, assume it worked");
						}
					},60000,res,reqUUID);
						
			}
			
		});

	});
	maintRequest.on('error', function(err) {
		console.log("Connection to Maint Listener  failed: " + err);
	});
        maintRequest.write(maintRequestString);
	maintRequest.end();

});


