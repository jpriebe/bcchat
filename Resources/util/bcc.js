//-----------------------------------------------------------------
// Copyright 2012 BrightContext Corporation
//
// Licensed under the MIT License defined in the 
// LICENSE file.  You may not use this file except in 
// compliance with the License.
//-----------------------------------------------------------------


BCC = ("undefined" == typeof(BCC)) ? {}: BCC;

/**
 * @class The BCC XHR object that encapsulates XHR, XDomainRequest and FLXHR for cross domain calls
 * @private
 */
BCC.Ajax = function() {
	this.xhr = null;
	this.ajaxReady = false;
	this.needsOpening = false;
	this.needsSending = false;
	this.status = BCC.AJAX_INITIALIZING;

	/**
	 * Called by the constructor to initialize the object 
	 * @private
	 */
	this._init = function(){
		var me = this;

		if (!BCC.Ajax.xhr_type_handle) {
			BCC.Ajax.xhr_type_handle = (BCC.XMLHttpRequest || window.XDomainRequest || window.XMLHttpRequest);
		}

		if (!BCC.Ajax.xhr_type_handle) {
			BCC.Env.checkFlashGateway(function (flash_gateway_error) {
				if (flash_gateway_error) {
					BCC.Log.error('no XMLHttpRequest object, XDomainRequest or polyfill available, provide one by setting BCC.XMLHttpRequest to a w3c compatible version', 'BCC.Ajax.constructor');
				} else {
					me.initWithFlashGateway(me);
				}
			});
		} else {
			this.xhr = ('undefined' == typeof(BCC.Ajax.xhr_type_handle.prototype)) ? BCC.Ajax.xhr_type_handle() : new BCC.Ajax.xhr_type_handle();
			this._doReady(); 
		}
	};

	this.initWithFlashGateway = function (me) {
		if ('undefined' == typeof(swfobject)) {
			BCC.Util.injectScript(BCC.Env.pathToLib(BCC.SWF_OBJECT_LIB_PATH), function (swf_load_error) {
				if (swf_load_error) {
					BCC.Log.error("Error injecting the SWFObject library","BCC.Ajax.constructor");
				} else {
					me.openWithFlashGateway(me);
				}
			});
		} else {
			me.openWithFlashGateway(me);
		}
	};

	this.openWithFlashGateway = function (me) {
		if (swfobject.hasFlashPlayerVersion("9.0.124")) {
			BCC.Log.debug("Flash Gateway Support available","BCC.Ajax.constructor");
			if (!BCC.Ajax.FlashLoaded) {
				BCC.Util.injectScript(BCC.Env.pathToLib(BCC.FLASH_XHR_SWF_PATH), function (flxhr_inject_error) {
					if(flxhr_inject_error){
						BCC.Log.error("Error injecting the Flash Gateway library","BCC.Ajax.constructor");
					} else {
						BCC.Ajax.FlashLoaded = true;
						me.xhr = new flensed.flXHR();
						me._doReady();
					}
				 });
			} else {  // BCC.Ajax.FlashLoaded is true
				me.xhr = new flensed.flXHR();
				me._doReady();
			}
		} else {
			BCC.Log.error("Browser config not supported","BCC.Ajax.constructor");
		}
	};

	/**
	 * Equivalent of xhr.open
	 * @param {string} method
	 * @param {string} url
	 * @param {boolean} async
	 * @param {string} uname
	 * @param {string} pswd
	 */
	this.open = function(method,url,async,uname,pswd) {
		this.status = BCC.AJAX_IN_PROGRESS;
		if(!this.ajaxReady){
			this.needsOpening = true;
			this.method = method;
			this.url = url;
			this.async = async;
			this.uname = uname;
			this.pswd = pswd;
		} else {
			try {
				this.xhr.open(method, url, async, uname, pswd);
			} catch(ex) {
				if (BCC.Util.isFn(this.onerror)) {
					this.onerror(ex);
				}
			}
		}
	};

	/**
	 * Equivalent of batch xhr.setRequestHeader calls
	 */
	this.setHeaders = function (headers) {
		if(!this.ajaxReady)
			this.headers = headers;
		else {
			this._setHeaders(headers);
		}
	};
	
	/**
	 * Sets the headers to xhr
		 * @private
		 */
		this._setHeaders = function (headers) {
				for (var k in headers) {
						var v = headers[k];
						try {
							this.xhr.setRequestHeader(k,v);
						} catch (ex) {
							BCC.Log.error('failed to set http header: ' + k + ' => ' + v, 'BCC.Ajax._setHeaders');
						}
				}
		};

	/**
	 * Equivalent of xhr.send
	 * @param {string} data Post data
	 */
	this.send = function(data){
		//flxhr fix : If the post data is null, the call is made as GET instead of POST.
		if(!this._isXhrCors() && !this._isXDomainRequest() && data == null)
			data = "NA";
		if(this.needsOpening === true){
			this.needsSending = true;
			this.data = data;
		} else {
			try {
				this.xhr.send(data);
			} catch (ex) {
				if (BCC.Util.isFn(this.onerror)) {
					this.onerror(ex);
				}
			}
		}
	};
	/**
	 * Returns the response text of the XHR call
	 * @returns {string} responseText
	 */ 
	this.getResponseText = function() {return this.xhr.responseText;};
	/**
	 * Returns the status of the XHR call
	 * @returns {string} status
	 */
	this.getStatus = function(){return this.status;};
	/**
	 * Aborts the XHR call
	 */
	this.abort = function(){
		if(this.needsOpening === true)
			this.needsOpening = false;
		else
			this.xhr.abort();
		this.status = BCC.AJAX_DONE;
		BCC.Log.debug("Ajax Call aborted","BCC.Ajax.abort");
	};

	/**
	 * Checks if XDR support available
	 * @private
	 * @returns {boolean}
	 */
	this._isXDomainRequest = function(){
		if (('undefined' !== typeof(window)) && (window.XDomainRequest))
			return true;
		else
			return false;
	};

	/**
	 * Checks if XHR CORS support available
	 * @private
	 * @returns {boolean}
	 */
	this._isXhrCors = function(){
		if (('undefined' !== typeof(XMLHttpRequest)) && ("withCredentials" in new XMLHttpRequest()))
			return true;
		else
			return false;
	};

	/** 
	* Checks if Titanium.Network.createHttpClient() is available
	* @private
	* @returns {boolean}
	*/
	this._isOverride = function() {
		if ('undefined' !== typeof(BCC.XMLHttpRequest))
			return true;
		else
			return false;
	};

	/**
	 * Post ready setup stuff done in this method
	 * @private
	 */
	this._doReady = function() {
		var me = this, invoke_callback;

		invoke_callback = function (f) {
			if (BCC.Util.isFn(f)) {
				f();
			}
		};

		if (this._isXDomainRequest()) {
			this.xhr.onload = function(){
				me.status = BCC.AJAX_DONE; 
				invoke_callback(me.onload);
			};

			this.xhr.onprogress = function(){
				invoke_callback(me.onprogress);
			};
			
			this.xhr.onerror = function(){
				me.status = BCC.AJAX_DONE; 
				invoke_callback(me.onerror);
			};

			this.xhr.ontimeout = function(){
				me.status = BCC.AJAX_DONE;
				invoke_callback(me.onerror);
			};
		} else {
			// not XDomainRequest

			this.xhr.onreadystatechange = function() {
				if (me.xhr.readyState == 3) {
					invoke_callback(me.onprogress);
				} else if (me.xhr.readyState == 4 && me.xhr.status == 200) {
					me.status = BCC.AJAX_DONE;
					invoke_callback(me.onload);
				} else if (me.xhr.readyState == 4 && me.xhr.status != 200) {
					if (me.status != BCC.AJAX_DONE) {
						me.status = BCC.AJAX_DONE;
						invoke_callback(me.onerror);
					}
				}
			};

			this.xhr.onprogress = function() {
				invoke_callback(me.onprogress);
			};

			// FLXHR raises onerror
			if(!this._isXhrCors()){
				this.xhr.onerror = function() {
					me.status = BCC.AJAX_DONE; 
					invoke_callback(me.onerror);
				};
			}
		}

		this.ajaxReady = true;
		
		if (this.needsOpening) {
			this._doOpen();
		} else {
			this.status = BCC.AJAX_READY;
		}
	};

	/**
	 * This method is fired when the open/send are called during the initialization
	 * @private
	 */
	this._doOpen = function() {
		this.status = BCC.AJAX_IN_PROGRESS;

		try {
			this.xhr.open(this.method, this.url, this.async, this.uname, this.pswd);
		} catch (ex) {
			if (BCC.Util.isFn(this.onerror)) {
				this.onerror(ex);
			}
		}
		
		this.needsOpening = false;

		if (!!this.headers){
			this._setHeaders(this.headers);
			this.headers = null;
		}

		if (this.needsSending === true) {
			try {
				this.xhr.send(this.data);
				this.needsSending = false;
			} catch (ex) {
				if (BCC.Util.isFn(this.onerror)) {
					this.onerror(ex);
				}
			}
		}
	};

	this._init();
	/**
	 * Equivalent to the XHR readystate=4 and status=200
	 * @name BCC.Ajax#onload
	 * @event
	 */
	
	 /** 
	 * Equivalent to the XHR readystate=3 and status=200
	 * @name BCC.Ajax#onprogress
	 * @event
	 */
	
	 /** 
	 * Equivalent to the XHR readystate=4 and status!=200
	 * @name BCC.Ajax#onerror
	 * @event
	 */
};

BCC.Ajax.FlashLoaded = false;

//-----------------------------------------------------------------
// Copyright 2012 BrightContext Corporation
//
// Licensed under the MIT License defined in the 
// LICENSE file.  You may not use this file except in 
// compliance with the License.
//-----------------------------------------------------------------

BCC = ("undefined" == typeof(BCC)) ? {}: BCC;

/**
 * @class Holds the metadata about all the feeds on a channel.
 * Use this when you need more information about a channel in order to select the correct feed before calling <code>project.feed(...)</code>
 * An example of when this might be used would be a real-time reporting application that supports graphing any feed output from any channel.
 * In that case, feed names would not necessarily be known, and channel metadata would need to be inspected first before knowing what is available
 * on a channel.
 * When the feed name is known, simply avoid <code>project.channel</code> and use <code>project.feed</code>
 * @constructor
 * @param {object} description The channel metadata containing feed information
 * @description
 * Channel objects should not be created manually, instead they are created using <code>project.channel(...)</code>
 * @see BCC.Project#channel
 * @see BCC.Project#feed
 */
BCC.Channel = function(description) {
    this._md = description;

    this._I = "IN";
    this._O = "OUT";
    this._T = "THRU";

    /** @returns {string} The name of the channel */
    this.name = function() {
        return this._md.channelName;
    };
    
    /** @returns {string} The type of the channel.  <code>UNPROCESSED</code> or <code>PROCESSED</code> */
    this.type = function() {
        return this._md.channelType;
    };

    /** @returns {Array} All the feed metadata inside the channel */
    this.feeds = function() {
        return this._md.feeds;
    };
    
    /**
     * select a feed by name
     * @param {string} n Name of the feed
     * @returns {object} Metadata about a particular feed with the given name
     * @example
     * {
     *   "id" : 23,
     *   "feedType" : "THRU",
     *   "name" : "default",
     *   "filters" : [
     *     "subChannel"
     *   ]
     * }
     */
    this.feed = function(n) {
        return this._filterByName(this.feeds(), n);
    };

    /** @returns {Array} All the metadata about input feeds */
    this.inputs = function() {
        return this._filterByType(this.feeds(), this._I);
    };
    
    /**
     * select an input feed by name
     * @param {string} n Name of the feed
     * @returns {object} Metadata about a particular input feed with the given name
     */
    this.input = function(n) {
        return this._filterByName(this.inputs(), n);
    };

    /** @returns All the metadata about output feeds */
    this.outputs = function() {
        return this._filterByType(this.feeds(), this._O);
    };
    
    /**
     * select an output feed by name
     * @param {string} n Name of the feed
     * @returns {object} Metadata about a particular output feed with the given name
     */
    this.output = function(n) {
        return this._filterByName(this.outputs(), n);
    };

    var areBothArraysTheSame = function(array1, array2) {
          var bothArraysExist = (( !! array1) && ( !! array2));
          if (bothArraysExist) {
              if (array1.length == array2.length) {
                  /*var ok = array1.every(function(e1) {
                      return array2.some(function(e2) {
                          return (e1 == e2);
                      });
                  });
                  return ok;*/
                  var ok = checkArrayElements(array1, array2);
                  return ok;
              } else {
                  return false;
              }
          } else {
              return false;
          }
    };
    
    var checkArrayElements = function(array1, array2){
       for(var index1 = 0; index1 < array1.length; index1++){
            var itemFound = false;
            var ele1 = array1[index1];
            for(var index2 = 0; index2 < array2.length; index2++){
                var ele2 = array2[index2];
                if(ele1 == ele2){
                    itemFound = true;
                    break;
                }
            }
            if(!itemFound)
                 return false;
        }
        return true;
    };

    this.validFilter = function(feedInfo, filterObj) {
        if ("undefined" == typeof(filterObj)) {
            var ok = (("undefined" == typeof(feedInfo)) || ("undefined" == typeof(feedInfo.filters)));
            return ok;
        } else {
            if ("object" === typeof(filterObj)) {
                var array1 = [];
                for (var k in filterObj) {
                    array1.push(k);
                }
                var array2 = feedInfo.filters;
                return areBothArraysTheSame(array1,array2);
            } else {
                return false;
            }
        }
    };

    this._filterByType = function(list, ft) {
        var arr = [];
        for(var index in list){
            if(list[index].feedType == ft)
                 arr.push(list[index]);
        }
        return (0 === arr.length) ? null: arr;
    };
    this._filterByName = function(list, n) {
        var f = null;
        for(var index in list){
            if(list[index].name == n){
                f = list[index];
                break;
            }
        }
        return f;
    };

    //this._init = function() {
    //};
    //
    //this._init();
};
//-----------------------------------------------------------------
// Copyright 2012 BrightContext Corporation
//
// Licensed under the MIT License defined in the 
// LICENSE file.  You may not use this file except in 
// compliance with the License.
//-----------------------------------------------------------------

BCC = ("undefined" == typeof(BCC)) ? {}: BCC;

/**
 * @class The BCC event oriented Command object. BCC.Command encapsulates XHR, XDomainRequest and FLXHR for cross domain calls
 * @param {string} method		"POST" or "GET"
 * @param {string} cmdString  /path/to/api.json
 * @param {object} parameters  {param1:value1, param2:value2, ..}
 * @private
 */
BCC.Command = function(method, cmdString, parameters) {
	this.action = method;
	this.cmd = cmdString;
	this.parameters = parameters;

	/**
	 * Called by the constructor to initialize the object 
	 * @private
	 */
	this._init = function(){
		if(cmdString == null){
			BCC.Log.error("Command String missing.","BCC.Command.constructor");
			return false;
		}
		return true;
	};

	/**
	 * Adds parameters to the object
	 * @param {object} param  {<param1>:<value1>, <param2>:<value2>, ..}
	 */
	this.addParam = function(param){
		if(this.parameters == null)
			this.parameters = {};
		for(var key in param) {
			this.parameters[key] = param[key];
		}
	};
	
	/*
	 * Check for command objects
	 */
	this.isCommand = function(){
		return true;
	};

	/**
	 * Adds a listener to the object
	 * @param {object} listenerObj BCC event oriented object 
	 */
	this.addListener = function(listenerObj) {
		BCC.EventDispatcher.register(BCC.EventDispatcher.getObjectKey(this), listenerObj);
	};

	/**
	 * Removes a listener from the object
	 * @param {object} listenerObj BCC event oriented object 
	 */
	this.removeListener = function(listenerObj) {
		BCC.EventDispatcher.unregister(BCC.EventDispatcher.getObjectKey(this), listenerObj);
	};

	/**
	 * Returns the command as a JSON String
	 * @returns {string} The JSON string corresponding to the BCC.Command 
	 */
	this.getCommandAsMessage = function() {
		var cmdname = this.action + " " + BCC.API_COMMAND_ROOT + this.cmd;
		
		var cmdJson = {cmd: cmdname};
		if(this.parameters != null)
			cmdJson.params = this.parameters;
		
		return JSON.stringify(cmdJson);
	};

	/**
	 * Returns the command as a URL Path
	 * @returns {string} The path string corresponding to the BCC.Command
	 */
	this.getCommandAsPath = function() {
		var url = this.cmd.substr(this.cmd.indexOf("/"));
		var cmd = url;
		var index = 0;

		var paramstring = JSON.stringify(this.parameters);
		cmd += "?params=" + escape(paramstring);

		return BCC.API_COMMAND_ROOT + cmd;
	};

	/**
	 * Get the command path without parameters
	 * @returns {string} The path to the API command with no parameters
	 */
	this.getCommandUrl = function () {
		var path = this.cmd.substr(this.cmd.indexOf("/"));
		return BCC.API_COMMAND_ROOT + path;
	};

	/**
	 * Get the command parameters as a url encoded string
	 * @returns url encoded string of parameters object
	 */
	this.getCommandParametersAsEscapedString = function () {
		var paramstring = JSON.stringify(this.parameters);
		return "params=" + escape(paramstring);
	};

	/**
	 * Returns the command action
	 * @returns {string} action
	 */
	this.getCommandAction = function() {
		return this.action;
	};

	/**
	 * Sends the command over the connection
	 * @param {BCC.Connection} connection 
	 */
	this.send = function(connection) {
			connection.send(this);
	};

	this._init();
	
	/**
	 * Fired on server response to the command send
	 * @name BCC.Command#onresponse
	 * @event
	 */
};
//-----------------------------------------------------------------
// Copyright 2012 BrightContext Corporation
//
// Licensed under the MIT License defined in the 
// LICENSE file.  You may not use this file except in 
// compliance with the License.
//-----------------------------------------------------------------

BCC = ("undefined" == typeof(BCC)) ? {}: BCC;

/**
 * @class The BCC Connection object that encapsulates Web Sockets, Flash Sockets, Web Streaming and Long Polling
 * @constructor
 * @param {string} apiKey the API key that will be used to create a session
 * @param {int} heartbeat_cycle  Time Duration of the heart beat cycle in Secs
 * @private
 */
BCC.Connection = function(apiKey, heartbeat_cycle) {
	var me = this;

	this.endpoint = null;
	this.heartbeat_cycle = heartbeat_cycle * 1000;
	this.heartbeat_interval_id = null;

	/**
	 * Called by the constructor to initialize the object 
	 * @private
	 */
	this._init = function() {
	};

	this.getMetrics = function () {
		if (!this._metrics) {
			this._metrics = new BCC.Util.Metrics();
		}
		return this._metrics;
	};

	this.resetAttempts = function () {
		this.getMetrics().set('socket_attempts' ,0);
		this.getMetrics().set('flash_attempts', 0);
		this.getMetrics().set('rest_attempts', 0);
	};

	/**
	 * This method returns the session JSON
	 * @returns {JSON} Session
	 * @private
	 */
	this.getSession = function() {
		return this.session;
	};

	/**
	 * Opens the socket/streaming connection
	 */
	this.open = function (completion) {
		me.getMetrics().inc('open');

		if (!me.session || !me.endpoint) {
			var session_create_attempts = me.getMetrics().inc('session_create_attempts');
			if (session_create_attempts > BCC.MAX_SESSION_ATTEMPTS) {
				completion('number of session creates exceeded maximum limit: ' + session_create_attempts);
			} else {
				var s = new BCC.Session(apiKey);
				s.create(function (session_create_error, established_session) {
					if (session_create_error) {
						BCC.Log.error(session_create_error, 'BCC.Connection.open');
						me.open(completion);	// recurse to find a new session
					} else {
						me.session = established_session;
						me.resetAttempts();

						me._connectToNextAvailableEndpoint(0, function (endpoint_connect_error, endpoint) {
							if (endpoint_connect_error) {
								completion(endpoint_connect_error);
							} else {
								me.endpoint = endpoint;
								me._startHeartbeats();

								completion(null, me);
							}
						});
					}
				});
			}
		} else {
			completion(null, me);
		}
	};

	/**
	 * current state of the connection
	 * @returns true if the endpoint is closed or non-existant, false otherwise
	 * @private
	 */
	this.isClosed = function () {
		var closed = ((!me.endpoint) || (me.endpoint.isClosed()));
		return closed;
	};

	/** current state of the connection
	 * @returns true if the session and endpoint are assigned and the endpoint is actively open
	 * @private
	 */
	this.isOpen = function () {
		var open = ((!!me.session) && (!!me.endpoint) && (me.endpoint.isOpen()));
		return open;
	};

	/**
	 * @returns true if the current endpoint uses the preamble functionality to pre-emptively send commands when it was created
	 */
	this.usesPreamble = function () {
		var r = (me.endpoint && (me.endpoint.getName() == 'stream'));
		return r;
	};

	/**
	 * Closes the socket/streaming connection
	 */
	this.close = function(completion) {
		me.getMetrics().inc('close');

		if (me.endpoint) {
			if (!me.endpoint.isClosed()) {
				me.getMetrics().inc('disconnect');
				me._stopHeartbeats();
				
				me.endpoint.disconnect(function (disconnect_error) {
					if (BCC.Util.isFn(completion)) {
						completion(disconnect_error, me);
					}

					if (disconnect_error) {
						me._invoke(me.onerror, disconnect_error);
					} else {
						me._invoke(me.onclose, null);
					}
				});
			} else {
				if (BCC.Util.isFn(completion)) {
					completion(null, me);	// endpoint already closed
				}
			}
		} else {
			if (BCC.Util.isFn(completion)) {
				completion(null, me);	// no endpoint
			}
		}
	};

	/**
	 * Sends the command over the socket connection or makes a REST call
	 * @param {BCC.Command} command
	 */
	this.send = function(command) {
		if (me.endpoint) {
			if (!me.endpoint.isClosed()) {
				me.endpoint.write(command);
			} else {
				me._stopHeartbeats();
				me._invoke(me.onerror, 'endpoint is closed');
			}
		} else {
			me._stopHeartbeats();
			me._invoke(me.onerror, 'no endpoint');
		}
	};

	/**
	 * Sends the heartbeat over the socket
	 * @private
	 */
	this._startHeartbeats = function() {
		if (me.heartbeat_interval_id) {
			BCC.Log.debug('could not start heartbeats, heartbeat_interval_id already scheduled', 'BCC.Connection._startHeartbeats');
		} else {
			BCC.Log.debug('starting heartbeats cycle at ' + me.heartbeat_cycle, 'BCC.Connection._startHeartbeats');
			me.heartbeat_interval_id = setInterval(me._sendHeartbeat, me.heartbeat_cycle);
		}
	};

	this._sendHeartbeat = function() {
		if (me.endpoint) {
			if (!me.endpoint.isClosed()) {
				me.endpoint.heartbeat();
			} else {
				me._stopHeartbeats();
				me._invoke(me.onerror, 'endpoint is closed');
			}
		} else {
			me._stopHeartbeats();
			me._invoke(me.onerror, 'no endpoint');
		}
	};

	/**
	 * Stops the heartbeat
	 * @private
	 */
	this._stopHeartbeats = function() {
		if (me.heartbeat_interval_id) {
			BCC.Log.debug('stopping heartbeats', 'BCC.Connection._stopHeartbeats');
			clearInterval(me.heartbeat_interval_id);
			me.heartbeat_interval_id = null;
		} else {
			BCC.Log.debug('could not stop heartbeats, no heartbeat_interval_id', 'BCC.Connection._stopHeartbeats');
		}
	};

	/** 
	 * Invokes an event handler with a parameter
	 * @private
	 */
	this._invoke = function (fn, param) {
		if (BCC.Util.isFn(fn)) {
			fn(param);
		}
	};

	this._connectToNextAvailableEndpoint = function (delay, completion) {
		var f = function () {
			var socket_attempts, flash_attempts, rest_attempts,
					available_endpoints, endpoint_url, connect_ep;

			available_endpoints = me.session.getEndpoints();

			connect_ep = function (sid, u, ep) {
				ep.setUrl(u);
				ep.setSessionId(sid);

				ep.onclose = function (close_error) {
					BCC.Log.debug('endpoint unexpectedly closed ' + close_error, ep.getName());

					if (me.endpoint) {
						me._invoke(me.onerror, close_error);
					}
				};

				ep.connect(function (endpoint_connect_error, opened_endpoint) {
					if (endpoint_connect_error) {
						BCC.Log.error(endpoint_connect_error, 'BCC.Connection._connectToNextAvailableEndpoint');
						me._connectToNextAvailableEndpoint(delay, completion);
					} else {
						completion(null, opened_endpoint);
					}
				});
			};

			socket_attempts = me.getMetrics().get('socket_attempts');
			if (socket_attempts < available_endpoints.socket.length) {
				me.getMetrics().inc('socket_attempts');
				endpoint_url = available_endpoints.socket[socket_attempts];

				BCC.Env.checkWebSocket(function (websocket_check_error) {
					if (websocket_check_error) {
						me._connectToNextAvailableEndpoint(delay, completion);
					} else {
						connect_ep(
							me.session.getSessionId(),
							me.session.getSocketUrl(endpoint_url),
							new BCC.WebSocketEndpoint()
						);
					}
				});

			} else {

				flash_attempts = me.getMetrics().get('flash_attempts');
				if (flash_attempts < available_endpoints.flash.length) {
					me.getMetrics().inc('flash_attempts');
					endpoint_url = available_endpoints.flash[flash_attempts];

					BCC.Env.checkFlashSocket(function (flashsocket_check_error) {
						if (flashsocket_check_error) {
							me._connectToNextAvailableEndpoint(delay, completion);
						} else {
							connect_ep(
								me.session.getSessionId(),
								me.session.getSocketUrl(endpoint_url),
								new BCC.FlashSocketEndpoint()
							);
						}
					});
				} else {

					rest_attempts = me.getMetrics().get('rest_attempts');
					if (rest_attempts < available_endpoints.rest.length) {
						me.getMetrics().inc('rest_attempts');
						endpoint_url = available_endpoints.rest[rest_attempts];
						
						BCC.Env.checkStreaming(function (streaming_check_error) {
							if (streaming_check_error) {
								completion('no endpoint types supported');
							} else {
								var pending_commands = [];
								if (BCC.Util.isFn(me.onpreamble)) {
									me.onpreamble(pending_commands);
								}

								connect_ep(
									me.session.getSessionId(),
									me.session.getStreamUrl(endpoint_url),
									new BCC.RestStreamEndpoint(pending_commands)
								);
							}
						});

					} else {
						completion('all endpoint connection attempts exhausted');
					}
				}
			}
		};

		setTimeout(f, delay);
	};

	this._reconnect = function (completion) {
		me.getMetrics().inc('reconnect');

		if ((!!me.endpoint) && (me.endpoint.isClosed())) {
			me.endpoint.connect(function (reconnect_error) {
				if (reconnect_error) {
					completion(reconnect_error, me);
				} else {
					me._startHeartbeats();
					completion(null, me);
				}
			});
		} else {
			completion(null, me);	// nothing to do
		}
	};

	this._fallback = function (completion) {
		var fallback_delay = 5000,
				conn_metrics,
				ep_metrics,
				reconnect_attempts,
				reconnect_timeout,
				heartbeat_in,
				heartbeat_out,
				ep_was_stable,
				ep_reconnect_attempts_exceeded,
				socket_attempts,
				flash_attempts,
				rest_attempts,
				available_endpoints,
				exhausted_all_endpoints
		;

		if (me.is_retrying_same_endpoint || me.is_finding_next_available_endpoint) {
			return;	// avoid double fallback event chains
		}

		me.getMetrics().inc('fallback');

		if (!me.endpoint || !me.session) {
			me.session = null;
			me.endpoint = null;

			me.open(function (new_session_error) {
				if (new_session_error) {
					var session_create_attempts = me.getMetrics().get('session_create_attempts');
					if (session_create_attempts < BCC.MAX_SESSION_ATTEMPTS) {
						me._fallback(completion);
					} else {
						completion(new_session_error);	// new sessions exceeded
					}
				} else {
					me.resetAttempts();

					completion(null, me);

					me.reopenFeeds();
				}
			});

		} else {
			if (!me.endpoint.isClosed()) {
				// first close the endpoint and come back
				me.close(function () {
					me._fallback(completion);
				});
			} else {
				conn_metrics = me.getMetrics();
				conn_metrics.print('connection fallback metrics');
				ep_metrics = me.endpoint.getMetrics();
				ep_metrics.print('endpoint fallback metrics');

				heartbeat_in = ep_metrics.get('heartbeat_in');
				heartbeat_out = ep_metrics.get('heartbeat_out');
				ep_was_stable = ((heartbeat_in >= 2) && (heartbeat_out >= 2));

				reconnect_attempts = ep_metrics.inc('reconnect_attempts');
				ep_reconnect_attempts_exceeded = (reconnect_attempts > BCC.MAX_ENDPOINT_ATTEMPTS);

				socket_attempts = conn_metrics.get('socket_attempts');
				flash_attempts = conn_metrics.get('flash_attempts');
				rest_attempts = conn_metrics.get('rest_attempts');
				available_endpoints = me.session.getEndpoints();
				exhausted_all_endpoints = ((socket_attempts > available_endpoints.socket.length) && (flash_attempts > available_endpoints.flash.length) && (rest_attempts > available_endpoints.rest.length));

				if (ep_reconnect_attempts_exceeded || exhausted_all_endpoints) {
          // jump to new session
					me.session = null;
					me.endpoint = null;
					me._fallback(completion);
				} else {
					if (ep_was_stable) {
						// retry the same endpoint
						me.is_retrying_same_endpoint = true;
						reconnect_timeout = reconnect_attempts * fallback_delay;

						setTimeout(function () {
							me.endpoint.connect(function (reconnect_error) {
								me.is_retrying_same_endpoint = false;

								if (reconnect_error) {
									me._fallback(completion);
								} else {
									me._startHeartbeats();
									completion(null, me);	// reconnected to same endpoint
								}
							});
						}, reconnect_timeout);
					} else {
						// degrade connection to next available
						me.is_finding_next_available_endpoint = true;

						me.endpoint = null;
						me._connectToNextAvailableEndpoint(fallback_delay, function (endpoint_connect_error, degradedEndpoint) {
							me.is_finding_next_available_endpoint = false;

							if (endpoint_connect_error) {
								me._fallback(completion);
							} else {
								me.endpoint = degradedEndpoint;
								me._startHeartbeats();

								completion(null, me);	// reconnected to degraded endpoint
							}
						});
					}
				}
			}
		}

	};

	this.reopenFeeds = function () {
		BCC.Log.debug('re-opening all feeds', "BCC.Connection.reopenFeeds");
		BCC._checkContextExists();
		BCC.ContextInstance._reRegisterAllFeeds();
	};

	this._init();

	/**
	 * Single Listener event fired when the connection is opened
	 * @name BCC.Connection#onopen
	 * @event
	 */

	/** 
	 * Single Listener event fired when the connection is closed
	 * @name BCC.Connection#onclose
	 * @event
	 */

	/** 
	 * Single Listener event fired when there is a connection error 
	 * @name BCC.Connection#onerror
	 * @event
	 */
};

//-----------------------------------------------------------------
// Copyright 2012 BrightContext Corporation
//
// Licensed under the MIT License defined in the 
// LICENSE file.  You may not use this file except in 
// compliance with the License.
//-----------------------------------------------------------------

BCC = ("undefined" == typeof(BCC)) ? {}: BCC;

/**
 * @class The main object that holds the connection, active user state, and other settings.
 * Used to open projects.
 * Initialized and created by calling BCC.init
 * @constructor 
 * @param {string} apiKey
 * @see BCC
 * @description Context instances should not be created manually, but instead initialized using BCC.init(apiKey)
 */
BCC.Context = function (apiKey) {
	var me = this;
	
	this._apiKey = apiKey;
	this.conn = null;
	this.feedRegistry = null;

	this.activityFlag = true;	// user active
	this.validateMessagesFlag = true;	// message contract validation
	
	/**
	 * Called by the constructor to initialize the object 
	 * @private
	 */
	this._init = function() {
		this.feedRegistry = new BCC.FeedRegistry();
	};
	
	/**
	 * Switch on validation of messages
	 * @private
	 */
	this.setValidateMessagesOn = function() {
		this.validateMessagesFlag = true;
	};

	/**
	 * Switch off validation of messages
	 * @private
	 */
	this.setValidateMessagesOff = function() {
		this.validateMessagesFlag = false;
	};

	/**
	 * @returns {boolean} true if Feed Message Validation logic will be executed, otherwise false
	 * @private
	 */
	this.getValidateMessagesFlag = function() {
		return this.validateMessagesFlag;
	};

	/**
	 * Sets the user as active
	 * @private
	 */
	this.setUserActive = function() {
		this.activityFlag = true;
	};

	/**
	 * Sets the user as inactive
	 * @private
	 */
	this.setUserInactive = function() {
		this.activityFlag = false;
	};

	/**
	 * Gets the user active state
	 * @private
	 */
	this.isUserActive = function() {
		return this.activityFlag;
	};


	/**
	 * This method sends the command over the connection if the connection is ready
	 * Otherwise the command send is cached in the dependency map
	 *     
	 * @param {BCC.Command} command
	 *
	 * @private
	 */
	this.sendCommand = function(command) {
		me._getConnection(function (connection_open_error) {
			if (connection_open_error) {
				BCC.Log.error('error sending command: ' + connection_open_error + ' :: ' + JSON.stringify(command), 'BCC.Context.sendCommand');
			} else {
				me.conn.send(command);
			}
		});
	};
	
	this._reRegisterAllFeeds = function(){
		var feedsArray = this.feedRegistry.getAllUniqueFeeds();
		if(feedsArray != null){
			for(var index=0; index < feedsArray.length; index++){
				var feed = feedsArray[index];
				feed.reopen(this.conn, this.feedRegistry);
			}
		}
	};

	/**
	 * Retrieves the current server time, useful for client timepoint synchronization.
	 * @param {function} completion The function to execute once the time is retrieved.
	 * Method signature: <code>function(server_time_object, error_object)</code>
	 * @example
	 * var ctx = BCC.init(my_api_key);
	 * ctx.serverTime(function(t,err) {
	 *   if (err) {
	 *     console.error(err); // failed to get server time
	 *   } else {
	 *     console.log(t); // t is a Date instance with the server time
	 *   }
	 * });
	 */
	this.serverTime = function (completion) {
		if ('function' !== typeof(completion)) {
			return;
		}

		cmd = new BCC.Command("GET", "/server/time.json");
		
		cmd.onresponse = function(evt) {
			completion(new Date(evt.stime));
		};
		
		cmd.onerror = function(err) {
			BCC.Log.error("Error getting server time: " + err, "BCC.Context.serverTime");
			var errorEvent = new BCC.Event("onerror", BCC.EventDispatcher.getObjectKey(me), err);
			BCC.EventDispatcher.dispatch(errorEvent);

			completion(null, err);
		};
		
		me.sendCommand(cmd);
	};

	/**
	 * Asks the server to build a new UUID (aka GUID but this is not a Microsoft implementation).
	 * These can be very useful as a user id or to group multiple related messages with each other.
	 * @param {function} completion The function to execute once the time is retrieved.
	 * Method signature: <code>function(uuid_string, error_object)</code>
	 * @example
	 * var ctx = BCC.init(my_api_key);
	 * ctx.sharedUuid(function(uuid,err) {
	 *   if (err) {
	 *     console.error(err); // failed to get server time
	 *   } else {
	 *     console.log(uuid); // uuid is a new unique string created by the server
	 *   }
	 * });
	 */
	this.sharedUuid = function (completion) {
		if ('function' !== typeof(completion)) {
			return;
		}

		cmd = new BCC.Command("GET", "/server/uuid.json");
		
		cmd.onresponse = function(evt) {
			completion(evt.d);
		};
		
		cmd.onerror = function(err) {
			BCC.Log.error("Error getting shared uuid: " + err, "BCC.Context.sharedUuid");
			var errorEvent = new BCC.Event("onerror", BCC.EventDispatcher.getObjectKey(me), err);
			BCC.EventDispatcher.dispatch(errorEvent);

			completion(null, err);
		};
		
		me.sendCommand(cmd);
	};

	/**
	 * Builds a new UUID without contacting the server using minimal calls to Math.random that is RFC4122v4 compliant.
	 * These can be very useful as a user id or to group multiple related messages with each other.
	 * @example
	 * var ctx = BCC.init(my_api_key);
	 * var uuid = ctx.uuid(); // uuid is a new unique string
	 */
	this.uuid = function (completion) {
		// http://www.broofa.com/Tools/Math.uuid.js
		
		var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(''),
			uuid = new Array(36),
			rnd=0,
			r,
			uuid_string;

		for (var i = 0; i < 36; i++) {
		  if (i==8 || i==13 ||  i==18 || i==23) {
			uuid[i] = '-';
		  } else if (i==14) {
			uuid[i] = '4';
		  } else {
			if (rnd <= 0x02) rnd = 0x2000000 + (Math.random()*0x1000000)|0;
			r = rnd & 0xf;
			rnd = rnd >> 4;
			uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
		  }
		}
		uuid_string = uuid.join('');

		if ('function' == typeof(completion)) {
			completion(uuid_string);
		}
		return uuid_string;
	};

	/**
	 * Opens a feed 
	 * @param {BCC.Feed} feed BCC.Feed instance with metadata
	 * @param {function} completion method fired method signature: <code>function(open_error, opened_feed)</code>
	 * @private
	 */
	this.openFeed = function(feed, completion) {
		var loaded_feed = me.feedRegistry.findFeedWithMetadata(feed);

		if (loaded_feed) {
			// feed already opened
			feed.reloadFeedSettings(feed.settings);
			completion(null, feed);
		} else {
			// when the feed needs a connection, fetch one lazily
			feed.onneedsconnection = function (connection_needed_callback) {
				me._getConnection(function (connection_open_error) {
					if (connection_open_error) {
						connection_needed_callback(connection_open_error);
					} else {
						connection_needed_callback(null, me.conn);
					}
				});
			};

			// create the open command which will get a connection later lazily
			var feed_open_cmd = feed.open(function (open_error) {
				if (open_error) {
					completion(open_error);
				} else {
					me.feedRegistry.registerFeed(feed);
					completion(null, feed);
				}
			});
			
			// lazy initialize the preamble portion of the command list
			if (!me._connection_preamble) {
				me._connection_preamble = [];
			}

			// save the pending feed for the command batches
			me._connection_preamble.push(feed_open_cmd);
		}
	};

	/**
	 * Closes a feed
	 * @private
	 */
	this.closeFeed = function(feed) {
		if (this.feedRegistry.getFeedCount(feed) > 1) {
			this._unregisterFeed(feed);
			var closeEvent = new BCC.Event("onclose", BCC.EventDispatcher.getObjectKey(feed), null);
			BCC.EventDispatcher.dispatch(closeEvent);
			
			BCC.EventDispatcher.unregister(feed.id, feed);
			BCC.EventDispatcher.unregister(feed.getSettings().feedKey, feed);
		} else {
			feed._close(this.conn);
		}
	};

	/**
	 * Opens a Project instance containing Channels as configured using the management console.
	 * This will not open the underlying Channel feeds.  Use <code>project.feed(...)</code> to do that.
	 * @returns {BCC.Project} Project object instance that allows access to Channel and Feed data.
	 * @param {string} projectName name of the project defined in the management console
	 * @see BCC.Feed
	 * @see BCC.Project
	 */
	this.project = function(projectName) {
		return new BCC.Project(projectName);
	};

	/**
	 * Unregisters a feed, and if nothing is left in the registry, closes the connection
	 * @private
	 */
	this._unregisterFeed = function(closedFeed) {
		if (this.feedRegistry.feedExists(closedFeed)) {
			this.feedRegistry.unRegisterFeed(closedFeed);
		}
	};

	this._getConnection = function (completion) {
		if (me.conn) {
			if (me.conn.endpoint) {
				if (me.conn.endpoint.isClosed()) {
					// have a connection and endpoint, but it's closed, open it back up
					me.conn._reconnect(function (reconnect_error) {
						if (reconnect_error) {
							completion(reconnect_error);
						} else {
							completion(null, me.conn);
						}
					});
				} else {
					completion(null, me.conn);
				}
			} else {
				// have a connection, but no valid endpoint yet, push this into the queue and wait
				if (!me.completions_awaiting_endpoint) {
					me.completions_awaiting_endpoint = [];
				}
				me.completions_awaiting_endpoint.push(completion);
			}
		} else {
			// don't have a connection, make one
			me._createConnection(function (connection_create_error) {
				completion(connection_create_error);

				if (me.completions_awaiting_endpoint) {
					for (var i in me.completions_awaiting_endpoint) {
					  var fn = me.completions_awaiting_endpoint[i];
					  fn(connection_create_error);
					}
				}
			});
		}
	};

	/**
	 * This method creates a connection object and queues the statement for execution
	 * @private
	 */
	this._createConnection = function(completion) {
		me.conn = new BCC.Connection(me._apiKey, 45);

		me.conn.onerror = function(connection_error) {
			BCC.Log.error("connection error: " + connection_error, 'BCC.Context._createConnection');
			me.conn._fallback(function (fallback_error) {
				if (fallback_error) {
					BCC.Log.error("fallback error: " + fallback_error, 'BCC.Context._createConnection');
					me.forceShutdown();
				}
			});
		};

		// preamble only fired on rest connections
		me.conn.onpreamble = function (preamble) {
			if (me._connection_preamble) {
				// compact multiple feed opens into a single stream open
				while (0 !== me._connection_preamble.length) {
					var cmd = me._connection_preamble.shift();
					preamble.push(cmd);
				}
			}
		};

		me.conn.open(function (connection_open_error) {
			completion(connection_open_error);
		});
	};

	this.forceShutdown = function () {
		if (me.conn) {
			me.conn.close();
		}
		
		if (me.feedRegistry) {
			var registeredFeeds = me.feedRegistry.getAllFeeds();

			if (!!registeredFeeds && registeredFeeds.length > 0){
				for (var index = 0; index < registeredFeeds.length; index++){
					var feedObj = registeredFeeds[index];
					var closeEvent = new BCC.Event("onclose", BCC.EventDispatcher.getObjectKey(feedObj), feedObj);
					BCC.EventDispatcher.dispatch(closeEvent);
				}
			}
		}
	};

	this._init();
};


/**
 * Initializes a new context session.  Currently there can be only one context session with one connection at a time on any given page.  Thus, only plan on calling init once per page load with the proper api key, as any second call to init will dispose of the old context.
 * @param {string} apiKey API Key configured in the management console.
 * @returns {BCC.Context} Newly initialized context instance that can be used to open projects and feeds
 * @see BCC.Context
 */
BCC.init = function (apiKey) {
	BCC.Log.debug('Initializing context with api key ' + apiKey, 'BCC.init');
	if (!!BCC.ContextInstance) {
		BCC.Log.debug('forcing shutdown of previous context instance', 'BCC.init');
		BCC.ContextInstance.forceShutdown();
	}
	BCC.ContextInstance = new BCC.Context(apiKey);
	return BCC.ContextInstance;
};

/**
 * Checks to see if a context has already been initialized
 * @private
 */
BCC._checkContextExists = function() {
	if (!BCC.ContextInstance) {
		throw "Context Not Initialized, use BCC.init";
	}
};

/**
 * <p>The current user active state.  This setting only affects active polling Inputs.</p>
 * <p>When the user is active, messages will continue to be sent on active polling Inputs automatically without the need to call <code>feed.send()</code> continuously.
 * Active polling does not start until the first message is sent.  Active polling will continue until the feed is closed.</p>
 * <p>When the user is inactive, active polling will pause, however, calls to <code>feed.send()</code> will still be passed to the server.
 * Active polling will stay paused on all active polling Inputs until the user is flagged as active again.
 * The SDK does not control active user state, that is up to the app consuming the SDK.
 * However, isUserActive will default to true.
 * In other words, users are assumed to be active when the context is initialized.</p>
 * <p>If no active polling Inputs are used, this flag has no effect.</p>
 * 
 * @param {boolean} isActive <strong>Optional</strong> - true if the user is active, false otherwise.  If left undefined, the value will not be changed.
 *
 * @returns {boolean} true if the user is active, false otherwise
 *
 * @throws Throws an exception if the context has not been initialized with BCC.init()
 */
BCC.userActive = function(isActive) {
	BCC._checkContextExists();
	
	if ("undefined" !== typeof(isActive)) {
		if (isActive) {
			BCC.ContextInstance.setUserActive();
		} else {
			BCC.ContextInstance.setUserInactive();
		}
	}

	return BCC.ContextInstance.isUserActive();
};

/**
 * <p>Gets and Sets the current state of channel feed message validation.</p>
 *
 * <p>When message validation on, every message passed to the system will be compared to the known server information about
 * a channel and validated before handing it off to the server.  Each message will be tested and validated
 * that every field that is expected by the server is present, and that each field is of the correct data type.
 * Use this when you have dynamic messages and you need to be notified with error handlers when messages do not conform.</p>
 *
 * <p>When message validation is off, any message will be sent to the server without checking the fields before sending.
 * If any message is improperly shaped, the server will quietly throw out the message and not process it.
 * Use this when you have a high volume of very concrete message structures that are not dynamic and want a small
 * performance boost.</p>
 *
 * @param {boolean} shouldValidate <strong>Optional</strong> - Flag indicating if validation should be on or off.  If left undefined, the value will not be changed.
 *
 * @returns {boolean} Flag indicating the current state of message validation
 * 
 * @throws Throws an exception if the context has not been initialized with BCC.init()
 */
BCC.fieldMessageValidation = function(shouldValidate) {
	BCC._checkContextExists();
	
	if ("undefined" !== typeof(shouldValidate)) {
		if (shouldValidate) {
			BCC.ContextInstance.setValidateMessagesOn();
		} else {
			BCC.ContextInstance.setValidateMessagesOff();
		}
	}
	
	return BCC.ContextInstance.getValidateMessagesFlag();
};

BCC.ContextInstance = null;
//-----------------------------------------------------------------
// Copyright 2012 BrightContext Corporation
//
// Licensed under the MIT License defined in the 
// LICENSE file.  You may not use this file except in 
// compliance with the License.
//-----------------------------------------------------------------

BCC = ("undefined" == typeof(BCC)) ? {}: BCC;

BCC.Endpoint = function (typename) {
	this._typename = typename;
	this._initialized = false;
	this._description = '';
};

// endpoint base

BCC.Endpoint.prototype.initialize = function () {
	this._metrics = this.getMetrics();
	this._initialized = true;
};

BCC.Endpoint.prototype.getName = function () {
	return this._typename;
};

BCC.Endpoint.prototype.getMetrics = function () {
	if ('object' !== typeof(this._metrics)) {
		this._metrics = new BCC.Util.Metrics();
	}
	return this._metrics;
};

BCC.Endpoint.prototype.getUrl = function () {
	return this._url;
};

BCC.Endpoint.prototype.setUrl = function (url) {
	this._url = url;
	return this._url;
};

BCC.Endpoint.prototype.getSessionId = function () {
	return this._sid;
};

BCC.Endpoint.prototype.setSessionId = function (sid) {
	this._sid = sid;
	return this._sid;
};

BCC.Endpoint.prototype.onopen = function (c) {
	BCC.Log.debug(this.getName() + "::onopen" + c);
};

BCC.Endpoint.prototype.printMetrics = function () {
	this.getMetrics().print(this.getName());
};

BCC.Endpoint.prototype.createEventFromResponse = function(json) {
	var eventData, eventObject;

	if ("object" === typeof(json)) {
		eventData = json;
	} else if ("string" === typeof(json)) {
		if ('' === json) {
			return; // nothing to do
		} else {
			try {
				eventData = JSON.parse(json);
			} catch(ex) {
				BCC.Log.error(ex, "BCC.Endpoint.createEventFromResponse");
				return null;
			}
		}
	}

	eventObject = new BCC.Event(eventData.eventType, eventData.eventKey, eventData.msg);
	return eventObject;
};

BCC.Endpoint.prototype.registerCommandWithDispatcher = function (command) {
	var k = BCC.EventDispatcher.getObjectKey(command);
	BCC.EventDispatcher.register(k, command);
	
	command.addParam({ sid: escape(this._sid) });
	command.addParam({ eventKey: "" + k });
};

BCC.Endpoint.prototype.isHeartbeatResponseEvent = function (event_object) {
	if ('object' !== typeof(event_object)) {
		return false;
	} else {
		if (0 !== parseInt(event_object.getKey(),10)) {
			return false;
		} else {
			var m = event_object.getMessage();
			if ('object' !== typeof(m)) {
				return false;
			} else {
				if ('hb' !== m.message) {
					return false;
				} else {
					return true;
				}
			}
		}		
	}
};

// inheritance

BCC.WebSocketEndpoint = function () { };
BCC.FlashSocketEndpoint = function () { };
BCC.RestStreamEndpoint = function (pending_commands) {
	// array of pending commands to compact into single stream/create
	this.preamble = pending_commands;
};

BCC.WebSocketEndpoint.prototype = new BCC.Endpoint('websocket');
BCC.FlashSocketEndpoint.prototype = new BCC.Endpoint('flashsocket');
BCC.RestStreamEndpoint.prototype = new BCC.Endpoint('stream');

// heartbeats

BCC.WebSocketEndpoint.prototype.heartbeat = function () {
	var s = this.getSocket();
	if (s) {
		this._metrics.inc('heartbeat_out');
		this.getSocket().send(BCC.HEART_BEAT_STRING);
	} else {
		BCC.Log.error('heartbeat failure, no socket', 'BCC.WebSocketEndpoint.heartbeat');
	}
};

BCC.FlashSocketEndpoint.prototype.heartbeat = BCC.WebSocketEndpoint.prototype.heartbeat;

BCC.RestStreamEndpoint.prototype.heartbeat = function () {
	var s = this._stream;

	if (s) {
		this._metrics.inc('heartbeat_out');

		if (BCC.AJAX_IN_PROGRESS === this._stream.status) {
			this._metrics.inc('heartbeat_in');
		} else {
			BCC.Log.error('heartbeat failure : stream status ' + this._stream.status, 'RestStreamEndpoint.heartbeat');
		}
	} else {
		BCC.Log.error('heartbeat failure, no stream', 'BCC.RestStreamEndpoint.heartbeat');
	}
};

// connect

BCC.WebSocketEndpoint.prototype.createSocket = function (url, completion) {
	BCC.Log.debug(url, this.getName());

	var s, socketT;

	if (BCC.Util.isFn(completion)) {
		socketT = (BCC.WebSocket || window.WebSocket || window.MozWebSocket);

		if ('undefined' === typeof(socketT)) {
			completion('no web socket support');
		} else {
			try {
				s = new socketT(url);
				completion(null, s);
				return s;
			} catch (ex) {
				completion(ex);
				return null;
			}
		}
	}
};

BCC.FlashSocketEndpoint.prototype.createSocket = BCC.WebSocketEndpoint.prototype.createSocket;

BCC.WebSocketEndpoint.prototype.getSocket = function () {
	return this._socket;
};

BCC.FlashSocketEndpoint.prototype.getSocket = BCC.WebSocketEndpoint.prototype.getSocket;

BCC.RestStreamEndpoint.prototype.getSocket = function () {
	return this._stream;
};

BCC.WebSocketEndpoint.prototype.wireupNewSocket = function (me, s, completion) {
	var opencount = 0,
			call_completion_count = 0,
			call_completion;

	call_completion = function (error_message) {
		// prevent against double completion handlers firing when we get both an onerror() and onclose() event
		if (1 == ++call_completion_count) {
			if (BCC.Util.isFn(completion)) {
				completion(error_message, me);
			}
		}
	};

	s.onopen = function(open_event) {
		opencount = me._metrics.inc('socket_open_event');
		me._socket = s;
		call_completion(null);
	};

	s.onclose = function(close_event) {
		me._metrics.inc('socket_close_event');
		if (0 === opencount) {
			// sometimes instead of errors, we get a "forced closed" event from the browser
			call_completion('socket closed without open');
		}
		me.connectionClosed(close_event || 'socket closed');
	};

	s.onmessage = function(message_event) {
		if (0 === opencount) {
			// just in case we get a message without an open event, notify things are well
			call_completion(null);
		}
		me._metrics.inc('socket_message_event');
		me.handleInboundData(message_event.data);
	};

	s.onerror = function(error_event) {
		if (0 === opencount) {
			// sometimes instead of errors, we get a "forced closed" event from the browser
			call_completion('socket error without open');
		}

		me._metrics.inc('socket_error_event');
		me.connectionError(error_event || 'unknown socket error');
	};
};

BCC.FlashSocketEndpoint.prototype.wireupNewSocket = BCC.WebSocketEndpoint.prototype.wireupNewSocket;

BCC.WebSocketEndpoint.prototype.connect = function (completion) {
	BCC.Env.flipToNativeWebSocket();

	var me = this;

	if (!me._initialized) {
		me.initialize();
	}

	me._metrics.inc('connect');

	me.createSocket(me.getUrl() + '?sid=' + me.getSessionId(), function (error, s) {
		if (error) {
			completion(error);
		} else {
			me.wireupNewSocket(me, s, completion);
		}
	});
};

BCC.FlashSocketEndpoint.prototype.connect = function (completion) {
	BCC.Env.flipToFlashWebSocket();

	var me = this;

	if (!me._initialized) {
		me.initialize();
	}
	me._metrics.inc('connect');

	me.getSwfObject(function (swf_load_error) {
		if (swf_load_error) {
			completion(swf_load_error);
		} else {

			me.getFlashSocketPolyfill(function (flashsocket_load_error) {
				if (flashsocket_load_error) {
					completion(flashsocket_load_error);
				} else {

					me.createSocket(me.getUrl() + '?sid=' + me.getSessionId(), function (socket_error, flashsocket) {
						if (socket_error) {
							completion(socket_error);
						} else {

							me.wireupNewSocket(me, flashsocket, completion);
						}
					});
				}
			});
		}
	});
};

BCC.FlashSocketEndpoint.prototype.getSwfObject = function (completion) {
	if ('undefined' == typeof(swfobject)) {
		BCC.Util.injectScript(BCC.Env.pathToLib(BCC.SWF_OBJECT_LIB_PATH), function (swf_load_error) {
			if (swf_load_error) {
				completion(swf_load_error);
			} else {
				completion(null, swfobject);
			}
		});
	} else {
		completion(null, swfobject);
	}
};

BCC.FlashSocketEndpoint.prototype.getFlashSocketPolyfill = function (completion) {
	if ('undefined' == typeof(BCC.FlashSocketEndpoint.polyfill_element)) {
		BCC.FlashSocketEndpoint.polyfill_element = BCC.Util.injectScript(BCC.Env.pathToLib(BCC.FLASH_SOCKET_SWF_PATH), function (polyfill_load_error) {
			if (polyfill_load_error) {
				completion(polyfill_load_error);
			} else {
				completion(null, BCC.FlashSocketEndpoint.polyfill_element);
			}
		});
	} else {
		completion(null, BCC.FlashSocketEndpoint.polyfill_element);
	}
};

BCC.RestStreamEndpoint.prototype.connect = function (completion) {
	var me = this;

	if (!me._initialized) {
		me.initialize();
	}
	me._metrics.inc('connect');

	// notify callers when the stream is initialized
	me._on_stream_initialized = completion;

	me.createStream(function (create_error) {
		if (create_error) {
			// notify callers when stream fails to create
			completion(create_error, me);
		}
	});
};

BCC.RestStreamEndpoint.prototype.createStream = function (completion) {
	var me = this,
			buffer = '',
			postbody = '',
			chomp;

	me.getMetrics().set('stream_initialized', 0);

	chomp = function (d) {
		me.handleInboundData(d.substr(buffer.length));	// feed partial data into the tokenizer
		buffer = d;
	};

	me.tokenizer = new BCC.StreamTokenizer();
	me.tokenizer.setCallback(function(data) {
		me.handleInboundObject(data);	// handle complete objects coming out of tokenizer
	});

	postbody = 'sid=' + me.getSessionId();
	if (me.preamble) {
		postbody += '&cmdList=[';
		while (0 !== me.preamble.length) {
			var cmd = me.preamble.shift();
			me.registerCommandWithDispatcher(cmd);
			postbody += cmd.getCommandAsMessage();
			if (0 !== me.preamble.length) {
				postbody += ',';
			}
			me._metrics.inc('preamble_commands');
		}
		postbody += ']';
	}

	me._stream = BCC.Util.makeRequest({
		url: me.getUrl(),
		data: postbody,
		onprogress: function (data) {
			chomp(data);
		},
		onload: function (response) {
			if (buffer.length != response.length) {
				chomp(response);
			}

			if (0 === me._metrics.get('stream_initialized')) {
				completion('stream closed without being initialized');
			}

			me.connectionClosed();
		},
		onerror: function (error) {
			if (me._stream) {
				if (!me._stream.deliberately_closed) {
					if (0 === me._metrics.get('stream_initialized')) {
						completion('stream initialization error');
					} else {
						// recurse to keep stream open, only if that fails, raise error for fallback
						setTimeout(function() {
							me.createStream(function (stream_create_error) {
								if (stream_create_error) {
									me.connectionError('failed to reconnect push stream: ' + stream_create_error);
								}
							});
						}, 0);
					}
				}
			} else {
				BCC.Log.error('stream error event on unknown stream: ' + error, 'BCC.RestStreamEndpoint.createStream');

				if (0 === me._metrics.get('stream_initialized')) {
					completion('stream initialization error');
				}
			}
		}
	});
	
	// autmatically fail in 5 seconds if we don't get stream initialized

	setTimeout(function () {
		if (0 === me._metrics.get('stream_initialized')) {
			me._stream.deliberately_closed = true;
			me._stream.abort();
			completion('stream initialization timeout');
		}
	}, 5000);
};

// disconnect

BCC.WebSocketEndpoint.prototype.disconnect = function (completion) {
	var me = this;

	me._metrics.inc('disconnect');
	BCC.Log.info('closing socket stream', 'WebSocketEndpoint.disconnect');

	if (me.isClosed()) {
		completion(null, me); // nothing to do
	} else {
		me.onclose = completion;
		me.getSocket().close();
	}
};

BCC.FlashSocketEndpoint.prototype.disconnect = function (completion) {
	var me = this,
			close_check_count = 0,
			close_check_limit = 5,
			close_check_interval = 1000,
			close_check_interval_id = null,
			too_many_checks = false,
			timeout_error = null
	;

	me._metrics.inc('disconnect');

	var s = me.getSocket();

	if (!s || me.isClosed()) {
		completion(null, me); // nothing to do
	} else {
		BCC.Log.info('closing flash stream', 'FlashSocketEndpoint.disconnect');

		s.close();

		// flash sockets do not always close down properly, so we enter a watch loop
		close_check_interval_id = setInterval(function () {
			++close_check_count;
			too_many_checks = (close_check_count >= close_check_limit);

			if (me.isClosed() || too_many_checks) {
				clearInterval(close_check_interval_id);
				close_check_interval_id = null;

				timeout_error = (too_many_checks) ? 'close timed out' : null;

				if (timeout_error) {
					me._socket.onopen = null;
					me._socket.onclose = null;
					me._socket.onmessage = null;
					me._socket.onerror = null;
					me._socket = null;
				}

				completion(timeout_error, me);
			} else {
				BCC.Log.error('flash socket slow closing', 'BCC.FlashSocketEndpoint.disconnect');
				s.close();	// try sending the close command again
			}
		}, close_check_interval);
	}

};

BCC.RestStreamEndpoint.prototype.disconnect = function (completion) {
	var me = this;

	me._metrics.inc('disconnect');
	BCC.Log.info('closing rest stream', 'RestStreamEndpoint.disconnect');

	me._stream.deliberately_closed = true;
	me._stream.abort();

	if (BCC.Util.isFn(completion)) {
		completion(null, me);
	}
};

// read

BCC.WebSocketEndpoint.prototype.handleInboundData = function (data) {
	BCC.Log.debug(data, this.getName());

	try {
		var event_object = this.createEventFromResponse(data);
		if (this.isHeartbeatResponseEvent(event_object)) {
			this._metrics.inc('heartbeat_in');
		} else {
			BCC.EventDispatcher.dispatch(event_object);
		}
	} catch (ex) {
		BCC.Log.error(ex, 'BCC.WebSocketEndpoint.handleInboundData');
	}
};

BCC.FlashSocketEndpoint.prototype.handleInboundData = BCC.WebSocketEndpoint.prototype.handleInboundData;

BCC.RestStreamEndpoint.prototype.handleInboundData = function (data) {
	this.tokenizer.appendData(data);
};

BCC.RestStreamEndpoint.prototype.handleInboundObject = function (o) {
	if ('string' === typeof(o.streaminitialized)) {
		this._metrics.inc('stream_initialized');

		BCC.Log.debug('stream initialized', 'BCC.RestStreamEndpoint.handleInboundObject');

		if (BCC.Util.isFn(this._on_stream_initialized)) {
			this._on_stream_initialized(null, this);
		}
	} else {
		BCC.Log.debug(JSON.stringify(o), this.getName());
		var event_object = this.createEventFromResponse(o);
		BCC.EventDispatcher.dispatch(event_object);
	}
};

// write

BCC.WebSocketEndpoint.prototype.write = function (command) {
	this._metrics.inc('write');
	this.registerCommandWithDispatcher(command);

	var msg = command.getCommandAsMessage();
	BCC.Log.debug(msg, this.getName());

	this.getSocket().send(msg);
};

BCC.FlashSocketEndpoint.prototype.write = BCC.WebSocketEndpoint.prototype.write;

BCC.RestStreamEndpoint.prototype.write = function (command) {
	var me = this,
			xhr, url, base, method, postbody;

	me.registerCommandWithDispatcher(command);

	base = BCC.Env.baseActionPath(me.getUrl());
	method = command.getCommandAction();

	if ('GET' == method) {
		url = BCC.Util.getBccUrl(base, command.getCommandUrl() + '?' + command.getCommandParametersAsEscapedString());
	} else {
		url = BCC.Util.getBccUrl(base, command.getCommandUrl());
		postbody = command.getCommandParametersAsEscapedString();
	}

	xhr = BCC.Util.makeRequest({
		url: url,
		method: method,
		data: postbody,
		onload: function (response) {
			me.handleInboundObject(response);
		},
		onerror: function (error) {
			BCC.Log.error(url + ' error: ' + error, 'RestStreamEndpoint.write');

			me.handleInboundObject(error || {
				eventType: 'onerror',
				eventKey: command.parameters.eventKey,
				msg: { error: "error processing request: " + url }
			});
		}
	});
};

// error handling and fallback logic

BCC.WebSocketEndpoint.prototype.isOpen = function () {
	var isOpen = false;

	if ('undefined' !== typeof(WebSocket)) {
		isOpen = (this._socket && (WebSocket.OPEN == this._socket.readyState));
	} else {
		isOpen = (this._socket && (1 == this._socket.readyState));
	}

	return isOpen;
};

BCC.FlashSocketEndpoint.prototype.isOpen = BCC.WebSocketEndpoint.prototype.isOpen;

BCC.WebSocketEndpoint.prototype.isClosed = function () {
	var isClosed = false;
	
	if (!this._socket) {
		isClosed = true;
	} else {
		if ('undefined' !== typeof(WebSocket)) {
			isClosed = (WebSocket.CLOSED == this._socket.readyState);
		} else {
			isClosed = (3 == this._socket.readyState);
		}
	}
	
	return isClosed;
};

BCC.FlashSocketEndpoint.prototype.isClosed = BCC.WebSocketEndpoint.prototype.isClosed;

BCC.RestStreamEndpoint.prototype.isOpen = function () {
	var isOpen = (this._stream && (BCC.AJAX_IN_PROGRESS == this._stream.status));
	return isOpen;
};

BCC.RestStreamEndpoint.prototype.isClosed = function () {
	var isClosed = (!this._stream || (BCC.AJAX_DONE == this._stream.status));
	return isClosed;
};

BCC.WebSocketEndpoint.prototype.connectionClosed = function (close_event) {
	BCC.Log.info(JSON.stringify(close_event), 'BCC.WebSocketEndpoint.connectionClosed');

	if (BCC.Util.isFn(this.onclose)) {
		this.onclose(null, this);
	} else {
		BCC.Log.debug('no onclose handler for ' + JSON.stringify(close_event), 'BCC.WebSocketEndpoint.connectionClosed');
	}
};

BCC.FlashSocketEndpoint.prototype.connectionClosed = function (close_event) {
	var me = this;
	
	BCC.Log.info(JSON.stringify(close_event), 'BCC.FlashSocketEndpoint.connectionClosed');
	
	if (BCC.Util.isFn(me.onclose)) {
		me.onclose(null, this);
	} else {
		BCC.Log.debug('no onclose handler for ' + JSON.stringify(close_event), 'BCC.FlashSocketEndpoint.connectionClosed');
	}
};

BCC.RestStreamEndpoint.prototype.connectionClosed = function (close_event) {
	BCC.Log.info(JSON.stringify(close_event), 'BCC.RestStreamEndpoint.connectionClosed');
	
	if (BCC.Util.isFn(this.onclose)) {
		this.onclose(null, this);
	} else {
		BCC.Log.debug('no onclose handler for ' + JSON.stringify(close_event), 'BCC.RestStreamEndpoint.connectionClosed');
	}
};

BCC.WebSocketEndpoint.prototype.connectionError = function (error_event) {
	BCC.Log.error(error_event, 'BCC.WebSocketEndpoint.connectionError');

	if (BCC.Util.isFn(this.onclose)) {
		this.onclose(error_event, this);
	} else {
		BCC.Log.debug('no onclose handler for ' + error_event, 'BCC.WebSocketEndpoint.connectionError');
	}
};

BCC.FlashSocketEndpoint.prototype.connectionError = function (error_event) {
	BCC.Log.error(error_event, 'BCC.FlashSocketEndpoint.connectionError');

	if (BCC.Util.isFn(this.onclose)) {
		this.onclose(error_event, this);
	} else {
		BCC.Log.debug('no onclose handler for ' + error_event, 'BCC.FlashSocketEndpoint.connectionError');
	}
};

BCC.RestStreamEndpoint.prototype.connectionError = function (error_event) {
	BCC.Log.error(error_event, 'BCC.RestStreamEndpoint.connectionError');

	if (BCC.Util.isFn(this.onclose)) {
		this.onclose(error_event, this);
	} else {
		BCC.Log.debug('no onclose handler for ' + error_event, 'BCC.RestStreamEndpoint.connectionError');
	}
};
//-----------------------------------------------------------------
// Copyright 2012 BrightContext Corporation
//
// Licensed under the MIT License defined in the 
// LICENSE file.  You may not use this file except in 
// compliance with the License.
//-----------------------------------------------------------------

BCC = ("undefined" == typeof(BCC)) ? {}: BCC;

/**
 * @class The Value Object that is used to pass messages in the BCC JS SDK  
 * @constructor
 * @param {string} eventType
 * @param {string} eventKey
 * @param {object} msg
 * @private
 */
BCC.Event = function(eventType, eventKey, msg) {
	this.eventType = eventType;
	this.eventKey = eventKey;
	this.msg = msg;

	/**
	 * Returns the eventType
	 * @returns {string}
	 */
	this.getType = function() { return this.eventType; };
	/**
	 * Returns the eventKey
	 * @returns {string}
	 */
	this.getKey = function() { return this.eventKey; };
	/**
	 * Returns the msg
	 * @returns {JSON}
	 */
	this.getMessage = function() { return this.msg; };
};

/**
 * The global Object that registers and dispatches events (BCC.Event) to the BCC event oriented objects
 * @namespace
 * @private
 */
BCC.EventDispatcher = {
		listenerMap : null,
		/**
		 * Called to initialize the global object 
		 * @private
		 */
		_init : function(){
			BCC.EventDispatcher.listenerMap = [];
		},
		/**
		 * Assigns and returns an id to the BCC event oriented object
		 * @param {object} object BCC event oriented object
		 * @returns {string} id of the object
		 */
		getObjectKey : function(object) {
			if(object.id == null) //timestamp + random # to give a unique ID
				object.id = new Date().getTime() + Math.floor(Math.random()*1000);
			return object.id;
		},
		/**
		 * Registers a BCC event oriented object to the key
		 * @param {string} key
		 * @param {object} listenerObj BCC event oriented object
		 */
		register : function(key, listenerObj) {
			//Sets the object Id to the listenerObj, if not already set
			BCC.EventDispatcher.getObjectKey(listenerObj);

			for(var index in BCC.EventDispatcher.listenerMap){
				if(key == BCC.EventDispatcher.listenerMap[index].key){
					BCC.EventDispatcher.listenerMap[index].addListener(listenerObj);
					return;
				}
			}
			BCC.EventDispatcher.listenerMap.push(new BCC.Listener(key, listenerObj));
		},
		/**
		 * Unregisters a BCC event oriented object from the key
		 * @param {string} key
		 * @param {object} listenerObj BCC event oriented object
		 */
		unregister : function(key, listenerObj) {
			for(var index in BCC.EventDispatcher.listenerMap){
				if(key == BCC.EventDispatcher.listenerMap[index].key){
					if(BCC.EventDispatcher.listenerMap[index].listeners.length == 1)
						BCC.EventDispatcher.listenerMap.splice(index, 1);
					else
						BCC.EventDispatcher.listenerMap[index].removeListener(listenerObj);
					return;
				}
			}
		},
		/**
		 * Gets the list of listeners from the listenerMap and dispatches the event (BCC.Event)   
		 * @param {BCC.Event} event_object 
		 */
		dispatch : function(event_object) {
			if (!event_object) return;

			if ('onerror' == event_object.eventType) {
				BCC.Log.error(JSON.stringify(event_object.msg), 'BCC.EventDispatcher.dispatch');
			}

			var listeners = BCC.EventDispatcher.getListeners(event_object.eventKey);
			for (var index in listeners) {
				var listener = listeners[index];
				var f = listener[event_object.eventType];				

				if ("function" == typeof(f)) {
					f.call(listener, event_object.msg);
				}
				
				if (("onresponse" == event_object.eventType) || ("onerror" == event_object.eventType)) {
					if(typeof listener.isCommand == "function" && !!(listener.isCommand())){
						BCC.EventDispatcher.unregister(listener.id, listener);
					}
				}
			}
		},
		/**
		 * Returns the list of listeners from the listenerMap for a key   
		 * @param {string} key
		 */
		getListeners : function(key) {
			var listeners = null;
			for(var index in BCC.EventDispatcher.listenerMap){
				if(key == BCC.EventDispatcher.listenerMap[index].key) {
					listeners = BCC.EventDispatcher.listenerMap[index].listeners;
					break;
				}
			}
			return listeners;
		}
};
BCC.EventDispatcher._init();

/**
 * @class The listener object that holds the registered listeners for the key   
 * @constructor
 * @param {string} key
 * @param {object} listenerObj BCC event oriented object
 * @private
 */
BCC.Listener = function(key, listenerObj){
	this.key = null;
	this.listeners = null;

	/**
	 * Called by the constructor to initialize the object 
	 * @private
	 */
	this._init = function(){
		if(key == null || listenerObj ==null){
			BCC.Log.error("Key and Listener are mandatory","BCC.Listener.constructor");
			return;
		}
		this.key = key;
		this.listeners = [];
		this.listeners.push(listenerObj);
	};
	/**
	 * Adds a listener
	 * @param {object} listenerObj BCC event oriented object
	 */
	this.addListener = function(listenerObj){
		this.listeners.push(listenerObj);
	};
	/**
	 * Removes a listener
	 * @param {object} listenerObj BCC event oriented object
	 */
	this.removeListener = function(listenerObj){
		for(var index in this.listeners){
			if(listenerObj.id == this.listeners[index].id)
				this.listeners.splice(index, 1);
		}
	};

	this._init();
};
//-----------------------------------------------------------------
// Copyright 2012 BrightContext Corporation
//
// Licensed under the MIT License defined in the 
// LICENSE file.  You may not use this file except in 
// compliance with the License.
//-----------------------------------------------------------------

BCC = ("undefined" == typeof(BCC)) ? {}: BCC;

/**
 * @class
 * <p>Represents a real-time stream of data.</p>
 * <p>For ThruChannels, this represents the default sub-channel, or any dynamic sub-channel created at runtime.</p>
 * <p>For QuantChannels, this represents any configured Input or Output using real-time server processing.</p>
 *
 * @description
 * <p>Feeds should not be created manually, simply call <code>project.feed(...)</code><p>
 *
 * @see BCC.Project#feed
 * @see BCC.Feed#addListener
 */
BCC.Feed = function(metadata, write_key) {

	// --- setup ---

	var me = this;

	this.handler = null;
	this.date_fields = null;
	this.conn = null;

	// meta data to be used for feed/session/create
	// {
	// 	"project": project_name,
	// 	"channel": channel_name,
	// 	"connector": connecor_name,
	// 	"filters": filter_object
	// }
	this.metadata = metadata;

	this.settings = {
		feedKey: null,
		filters: {}
	};

	// optional key to use for sending messages
	this.writeKey = (!!write_key) ? write_key : null;

	/**
	 * Called by the constructor to initialize the object 
	 * @private
	 */
	this._init = function() {
		me._setState(BCC.Feed.State.CLOSED);
	};

	//
	// --- listener management ---
	//

	/**
	 * Adds a listener to the feed.  Any one feed can have multiple listeners.
	 * All listeners will be dispatched events about the feed in the order they were added as listeners.
	 * Listeners can be removed using <code>removeListener</code>
	 *
	 * @param {object} listenerObj object that has one event handler per event name
	 * 
	 * @example
	 * f.addListener({
	 *   'onopen': function(f) {
	 *   },
	 *   'onerror': function(err) {
	 *   },
	 *   // other events ...
	 * });
	 * 
	 * @see onopen
	 * @see onclose
	 * @see onmsgreceived
	 * @see onmsgsent
	 * @see onopen
	 * @see onhistory
	 * @see onerror
	 * 
	 */
	this.addListener = function(listenerObj) {
		BCC.EventDispatcher.register(BCC.EventDispatcher.getObjectKey(me), listenerObj);
	};

	/**
	 * Removes a listener from the object
	 * @param {object} listenerObj the listener that was added using <code>addListener</code>
	 */
	this.removeListener = function(listenerObj) {
		BCC.EventDispatcher.unregister(BCC.EventDispatcher.getObjectKey(me), listenerObj);
	};

	//
	// --- simple properties ---
	//

	this.getHandler = function () {
		return this.handler;
	};

	/**
	 * Sets the handler to the feed
	 * @param {BCC.handler} fh
	 * @private
	 */
	this.setHandler = function(fh){
		this.handler = fh;
		return this.handler;
	};

	/**
	 * <p>Unlocks a write protected feed.</p>
	 * <p>Write protection is an option that is off by default and must be turned on using the management console.
	 * Once enabled, a write key will be generated by the server.
	 * A write key must be set using this method before calling <code>send</code> if one was not provided when opening the feed using <code>project.feed(...)</code>.
	 * </p>
	 * @param {string} k The value of the write key that was generated using the management console.
	 * @example
	 * // Method A - assigning the write key using project.feed
	 * project.feed({
	 *   channel: 'my protected thru channel',
	 *   writekey: 'my write key',
	 *   onopen: function(protected_feed) {
	 *     protected_feed.send({ fix: 'all the things'});
	 *   }
	 * });
	 * 
	 * // Method B - assigning the write key after the feed is already open
	 * my_feed.setWriteKey('my write key');
	 * my_feed.send({ belongings: ['all', 'your', 'base'] });
	 * @see BCC.Project#feed
	 */
	this.setWriteKey = function(k){
		me.write_key = k;
	};
	
	/** @private */
	this._isInState = function(state_name) {
		if ('undefined' == typeof(me.settings)) {
			me.settings = {};
		}
		var is = (me.settings.state == state_name);
		return is;
	};
	
	/** True if the feed is open, false otherwise */
	this.isOpen = function() {
		return me._isInState(BCC.Feed.State.OPEN);
	};
	
	/** True if the feed is closed, false otherwise */
	this.isClosed = function() {
		return me._isInState(BCC.Feed.State.CLOSED);
	};
	
	/** True if the feed encountered an error, false otherwise */
	this.hasError = function() {
		// TODO: probably should leave state alone and instead use a separate error property or array
		return me._isInState(BCC.Feed.State.ERROR);
	};

	/** sets the state of the feed
	 * @private
	 */
	this._setState = function (state_name) {
		if ('undefined' == typeof(me.settings)) {
			me.settings = {};
		}
		me.settings.state = state_name;
	};

	/**
	 * Returns the feed Id
	 * @returns {string}
	 * @private
	 */
	this.getFeedKey = function() {
		return me.settings.feedKey;
	};

	/**
	 * Returns the feed settings
	 * @returns {JSON}
	 * @private
	 */
	this.getSettings = function() { // used by feed registry to get feed settings from one feed so it can reload another
		return me.settings;
	};

	/**
	 * returns a handle to the connection
	 * @private
	 */
	this.getConnection = function () {
		return me.conn;
	};

	/**
	 * sets and returns the connection object to use for actions like open and history
	 */
	this.setConnection = function (c) {
		me.conn = c;
		return me.conn;
	};

	/** the command object that was used to open the feed */
	this.getOpenCommand = function () {
		return me._createCommand;
	};

	this.shortDescription = function () {
		return JSON.stringify(me.metadata);
	};

	this.hasMetadata = function (md) {
		var serialized_md = JSON.stringify(md).toLowerCase().split('').sort().join();
		var my_serialized_md = JSON.stringify(me.metadata).toLowerCase().split('').sort().join();
		return (serialized_md == my_serialized_md);
	};

	//
	// --- actions ---
	//

	/**
	 * This method reopens the feed over the connection and is used on reconnect.
	 * @private
	 */
	this.reopen = function(connection, fr) {
		if (("undefined" == typeof(connection)) || (null === connection)) {
			BCC.Log.error("Invalid connection object, cannot reopen feeds","BCC.Feed.reopen");
			return;
		}

		this.conn = connection;

		var cmd = me._getFeedSessionCreateCommand(function (feed_open_error, feed_open_response) {
			if (feed_open_error) {
				BCC.Log.error(feed_open_error, "BCC.Feed.reopen");
				me.settings = {};
				me.settings.state = "error";

				var feedsForKey = fr.getAllFeedsForKey(me);
				for(var index = 0; index < feedsForKey.length; index++){
					var feedObj = feedsForKey[index];
					fr.unRegisterFeed(feedObj);
					var errorEvent = new BCC.Event("onclose", BCC.EventDispatcher.getObjectKey(feedObj), feedObj);
					BCC.EventDispatcher.dispatch(errorEvent);
				}
			} else {
				BCC.Log.debug("Feed reopened succesfully.", "BCC.Feed.reopen");
			}
		});
		
		cmd.send(connection);
	};

	this.open = function (completion) {
		var cmd = me._getFeedSessionCreateCommand(function (feed_open_error, feed_open_response) {
			if (feed_open_error) {
				completion(feed_open_error, me);
			} else {
				me.reloadFeedSettings(feed_open_response);

				completion(null, me);

				var k = BCC.EventDispatcher.getObjectKey(me);
				var feed_opened_event = new BCC.Event('onopen', k, me);
				BCC.EventDispatcher.dispatch(feed_opened_event);
			}
		});

		if (me.conn) {
			cmd.send(me.conn);
		} else {
			me.onneedsconnection(function (connection_error, open_connection) {
				if (connection_error) {
					BCC.Log.error(connection_error, 'BCC.Feed.open');
				} else {
					me.conn = open_connection;
					if (!me.conn.usesPreamble()) {
						cmd.send(me.conn);
					}
				}
			});
		}

		return cmd;
	};

	/**
	 * issues the feed/session/create command using the feed description and invokes the callback
	 */
	this._getFeedSessionCreateCommand = function (completion) {
		var cmd = new BCC.Command("POST", "/feed/session/create.json",
		{
			"feedDesc": me.metadata
		});
		
		cmd.onresponse = function(open_response) {
			if (BCC.Util.isFn(completion)) {
				completion(null, open_response);
			}
		};
		
		cmd.onerror = function(error_data) {
			if (BCC.Util.isFn(completion)) {
				completion(error_data);
			}
		};
		
		return cmd;
	};

	/**
	 * <p>Closes the feed. Once a feed is closed, no events will be recieved on it, and no data can be sent to the server on it.</p>
	 * <p>If this is the last feed that was opened, the connection to the server will be closed as well.
	 * Any attempt to open a feed when no connection is open will open the connection to the server automatically.
	 * Thus, if switching between only two feeds, it might make more sense to open one, and then close the other
	 * rather than close one first.  This will avoid unnecessarily closing the connection.</p>
	 */
	this.close = function() {
		BCC._checkContextExists();
		BCC.ContextInstance.closeFeed(this);
	};
	
	/**
	 * Closes the feed with the server
	 * @private
	 */
	this._close = function(connection) {
		var cmd = new BCC.Command("POST", "/feed/session/delete.json", {
			fklist : this.settings.feedKey
		});
		
		cmd.onresponse = function(event) {
			me.settings.state = "closed";
			me.handler = null;
			me.conn = null;
			var closeEvent = new BCC.Event("onclose", BCC.EventDispatcher.getObjectKey(me), me);
			BCC.EventDispatcher.dispatch(closeEvent);
			
			BCC.EventDispatcher.unregister(me.id, me);
			BCC.EventDispatcher.unregister(me.settings.feedKey, me);
			me._cleanUpFeed();
		};
		
		cmd.onerror = function(err) {
			if (!!!!me.settings) {
				me.settings = {};
			}
			me.settings.state = "error";
			BCC.Log.error("Error closing feed: " + err, "BCC.Feed.close");
			var errorEvent = new BCC.Event("onerror", BCC.EventDispatcher.getObjectKey(me), err);
			BCC.EventDispatcher.dispatch(errorEvent);
			
			BCC.EventDispatcher.unregister(me.id, me);
			BCC.EventDispatcher.unregister(me.settings.feedKey, me);
			me._cleanUpFeed();
		};
		
		var cx = ("undefined" == typeof(connection)) ? this.conn : connection;
		cmd.send(cx);
	};
	
	/**
	 * Clean up the connection
	 * @private
	 */
	this._cleanUpFeed = function(){
		BCC._checkContextExists();
		BCC.ContextInstance._unregisterFeed(this);

		if (BCC.ContextInstance.feedRegistry.isEmpty() && !!BCC.ContextInstance.conn) {
			// wait 1 full second before actually shutting down the connection and double check if it's actually empty again
			// there may be something else that comes along and opens a different feed in-between
			setTimeout(function () {
				// Close the connection if the feed registry is now completely empty
				if (BCC.ContextInstance.feedRegistry.isEmpty() && !!BCC.ContextInstance.conn) {
					BCC.ContextInstance.conn.close();
				}
			}, 1000);
		}
	};

	/**
	 * Reloads the feed settings and reregisters the listeners for the new feed id
	 * @param {object} s The settings from the other feed object that was already loaded
	 * @private
	 */
	this.reloadFeedSettings = function(s) {
		BCC.Log.debug('loading feed with settings: ' + JSON.stringify(s), 'BCC.Feed.reloadFeedSettings');
		me.settings = s;
		BCC.EventDispatcher.register(BCC.EventDispatcher.getObjectKey(me), me);
		BCC.EventDispatcher.register(me.settings.feedKey, me);
		me._extractdate_fields(s);
	};

	/**
	 * <p>Sends a message to the server for processing and broadcasting.
	 * This is an asynchronous operation that may fail.
	 * Any notification of failure is delivered to all listeners using the <code>onerror</code> event handler.</p>
	 * <p>Possible types of failures:</p>
	 * <ul>
	 * <li>If message contract validation is turned on, the fields of the message will be validated client-side before sending to the server.</li>
	 * <li>Messages can only be sent on open feeds.  If a feed has not been opened, or a feed has been closed, no message will be sent.</li>
	 * <li>Attempting to send a message on a write protected feed that has not been unlocked using the correct write key will result in <code>onerror</code> event handler being fired.</li>
	 * </ul>
	 * 
	 * @param {object} msg
	 * <p>On QuantChannels, this is the message that should be sent for processing matching the shape of the Input.
	 * In other words, if the Input has three fields: <code>a</code>, <code>b</code> and <code>c</code> this message should have those three fields.
	 * Any attempt to send a message on an Output will have no effect.</p>
	 * <p>On ThruChannels, this may be any valid JSON to be broadcasted to all listeners.</p>
	 * 
	 */
	this.send = function(msg) {
		if (!msg) return;
		
		if(this.handler != null && this.conn != null) {
			this.handler.sendMsg(msg, this, this.conn);
		} else {
			BCC.Log.error("Feed is closed. Cannot send message over the feed at this time." ,"BCC.Feed.sendMsg");
		}
	};
	
	/**
	 * Retrieves messages that were sent on a feed in the past.
	 * Available only for feeds using ChannelWrite to store channel data.
	 * @param {number} limit <strong>Optional</strong> - Default 10.  The maximum number of historic messages to fetch.
	 * @param {date} ending <strong>Optional</strong> - Date object that represents the most recent date of a historic message that will be returned. Any message that occurred later than this date will be filtered out of the results.
	 * @param {function} completion <strong>Optional</strong> - Extra completion handler for the onhistory event.  This is only needed if you originally opened the feed using project.feed(), but did not provide an onhistory callback handler.  Method signature: <code>function (feed, history) {}</code>
	 * @example
	 * // Method A - using a global event handler
	 * p.feed({
	 *   onopen: function(f) {
	 *     f.history();
	 *   },
	 *   onhistory: function(f, h) {
	 *     console.log(h); // array of 10 most recent messages
	 *   }
	 * });
	 * 
	 * // Method B - using the inline history handler
	 * f.history(
	 *   3,	// fetch three messages
	 *   new Date(2012,0,3), // sent on or before Tue Jan 03 2012 00:00:00 local time
	 *   function(f,h) {
	 *     console.log(h);
	 *   }
	 * );
	 */
	this.history = function(limit, ending, completion) {
		var cmd = null,
				cmd_opts = {};

		cmd_opts.feedKey = this.settings.feedKey;
		if (ending) {
			cmd_opts.sinceTS = (new Date(ending)).getTime();
		}
		if (limit) {
			cmd_opts.limit = limit;
		}

		cmd = new BCC.Command("GET", "/feed/message/history.json", cmd_opts);
		
		cmd.onresponse = function(evt) {
			var historyEvent = new BCC.Event("onhistory", BCC.EventDispatcher.getObjectKey(me), evt);
			BCC.EventDispatcher.dispatch(historyEvent);

			if ('function' === typeof(completion)) {
				completion(me, evt);
			}
		};
		
		cmd.onerror = function(err) {
			BCC.Log.error("Error getting feed history: " + err, "BCC.Feed.getHistory");
			var errorEvent = new BCC.Event("onerror", BCC.EventDispatcher.getObjectKey(me), err);
			BCC.EventDispatcher.dispatch(errorEvent);
		};
		
		this.conn.send(cmd);
		return true;
	};

	/**
	 * Retrieves messages that were sent on a feed in the past.
	 * @private
	 */
	this.getHistory = this.history;
	
	this._extractdate_fields = function(feedSettings){
		if(feedSettings.feedType == BCC.Feed.OUTPUT_TYPE){
			var date_fields = [];
			for (var index=0; index<feedSettings.msgContract.length; index++) {
				if(feedSettings.msgContract[index].fieldType == BCC.Feed.DATE_FIELD){
					date_fields.push(feedSettings.msgContract[index].fieldName);
				}
			}
			this.date_fields = date_fields.length > 0 ? date_fields : null;
		}
	};

	this.onfeedmessage = function(msg){
		if (BCC.Util.isFn(this.onmsgreceived)) {
			var msgJson = ("string" == typeof(msg)) ? JSON.parse(msg) : JSON.parse(JSON.stringify(msg));	// cheap hack to .clone()
			if (this.date_fields != null){
				for (var index=0; index<this.date_fields.length; index++) {
					var field = this.date_fields[index];
					if (Object.prototype.hasOwnProperty.call(msgJson, field)) {
						if ("number" == typeof(msgJson[field])) {
							msgJson[field] = new Date(parseInt(msgJson[field],10));
						}
					}
				}
			}
			this.onmsgreceived(msgJson);
		}
	};
	
	this._init();
	
	/**
	 * Fired when message is pushed down from the server to the client.
	 * @name BCC.Feed#onmsgreceived
	 * @event
	 * @see BCC.Project#feed
	 */

	/**
	 * Fired after a message is successfully sent from the client to the server for processing or broadcasting.
	 * @name BCC.Feed#onmsgsent
	 * @event
	 * @see BCC.Feed#send
	 */
	
	/**
	 * Fired after the feed is opened and is ready for use.
	 * @name BCC.Feed#onopen
	 * @event
	 * @see BCC.Project#feed
	 */
	
	/**
	 * Fired in response to a successful <code>getHistory</code>.
	 * @name BCC.Feed#onhistory
	 * @event
	 * @see BCC.Feed#history
	 */
	
	/**
	 * Fired when the feed is successfully closed.
	 * @name BCC.Feed#onclose
	 * @event
	 * @see BCC.Feed#close
	 */
	
	/**
	 * Fired any time there is an error with any command.
	 * @name BCC.Feed#onerror
	 * @event
	 */
};

BCC.Feed.INPUT_TYPE = "IN";
BCC.Feed.OUTPUT_TYPE = "OUT";
BCC.Feed.UNPROCESSED_TYPE = "THRU";

BCC.Feed.DATE_FIELD = "D";

BCC.Feed.State = {
	OPEN: "open",
	OPENING: "opening",
	CLOSED: "closed",
	ERROR: "error"
};

/** @private */
BCC.Feed.DEFAULT_FEED_NAME = "default";

/** @private */
BCC.Feed.DEFAULT_SUBCHANNEL_FILTER = "subChannel";


//-----------------------------------------------------------------
// Copyright 2012 BrightContext Corporation
//
// Licensed under the MIT License defined in the 
// LICENSE file.  You may not use this file except in 
// compliance with the License.
//-----------------------------------------------------------------

BCC = ("undefined" == typeof(BCC)) ? {}: BCC;

/**
 * @class The object that handles the sending of messages over a feed   
 * @constructor
 * @param {object} feedSettings
 * @private
 */
BCC.FeedHandler = function(feedSettings) {
	this.feedSettings = feedSettings;
	this.lastMsg = null;
	this.cycleHandler = null;
	this.activeUserCycleInprogress = false;
	this.msgPending = false;
	this.msgQueue = [];
	
	/**
	 * Returns the feedSettings JSON
	 * @returns {object} feedSettings JSON
	 */
	this.getSettings = function() {
		return this.feedSettings;
	};

	/**
	 * Empties the message queue
	 * @private
	*/
	this._clearMsgQueue = function(){
		this.msgQueue = [];
		BCC.Log.debug("Message queue cleared." ,"BCC.FeedHandler._clearMsgQueue");
	};
	
	/**
	 * Checks if the message needs to be queued
	 * @private 
	 * @param {object} msg  
	 * @param {BCC.Feed} feed 
	 * @param {BCC.Connection} conn 
	 * @param {boolean} cycleTriggered Flag that indicates if the method is invoked automatically as part of the active user cycle
	 */	
	this._checkIfMsgSendable = function(msg, feed, conn, cycleTriggered){
		if(!!this.msgPending){
			if(cycleTriggered){ //A REVOTE is sent and there is a message pending
				this._clearMsgQueue(); //The queue might have updates queued up. Clear it all as the active cycle is over
				this.msgPending = false;
				BCC.Log.debug("REVOTE not queued" ,"BCC.FeedHandler._checkIfMsgSendable");
				return true; //Send the REVOTE immediately
			} else {
				if (!this.activeUserCycleInprogress) { //This is an INITIAL
					this._clearMsgQueue(); //The queue might have updates queued up. Clear it all as the active cycle is over
					this.msgPending = false;
					BCC.Log.debug("INITIAL not queued" ,"BCC.FeedHandler._checkIfMsgSendable");
					return true; //Send the INITIAL immediately
				} else {
					this._clearMsgQueue(); //The queue will hold just one UPDATE. The previous UPDATE was not sent on-time. So it does not hold good anymore  
					BCC.Log.debug("Message (UPDATE) queued." ,"BCC.FeedHandler._checkForMsgQueue");
					this.msgQueue.push({"msg": msg, "feed" : feed, "conn": conn, "cycleTriggered" : cycleTriggered});
					return false; //UPDATE queued
				}
			}
		}
		return true; //No need for queuing the message. Send it immediately
	};
	
	/**
	 * Sends the message over the feed
	 * @param {object} msg  
	 * @param {BCC.Feed} feed 
	 * @param {BCC.Connection} conn 
	 * @param {boolean} cycleTriggered Flag that indicates if the method is invoked automatically as part of the active user cycle
	 */
	this.sendMsg = function(msg, feed, conn, cycleTriggered){
		if(!this._checkIfMsgSendable(msg, feed, conn, cycleTriggered)){
			return false;
		}
		if(!!BCC.ContextInstance.getValidateMessagesFlag()){
			var error = this._checkMsgContract(msg);
			if(!!error){
				var event = new BCC.Event("onerror", BCC.EventDispatcher.getObjectKey(feed), "Message contract not honored. " + error);
				BCC.EventDispatcher.dispatch(event);
				return false;
			}
		}
		
		var state = this._getMsgState(cycleTriggered);

		var command = this._prepareCommand(msg, feed, state);
		state = (!!command && !!command.parameters  && !!command.parameters.metadata) ? command.parameters.metadata.state : state;
		
		if(!!command){
			if(state == BCC.STATE_INITIAL || state == BCC.STATE_REVOTE){
				this.msgPending = true;
			}
			command.send(conn);

			if(state == BCC.STATE_INITIAL && this.feedSettings.activeUserFlag){
				var me = this;
				this.activeUserCycleInprogress = true;
				BCC.Log.info("Active User Cycle (" + this.feedSettings.activeUserCycle + " secs) Started" ,"BCC.FeedHandler.sendMsg");
				this.cycleHandler = setInterval(function(){
					me._activeUserCycle(conn);
				}, this.feedSettings.activeUserCycle*1000);
			}
		}
		return true;
	};

	/**
	 * Checks if the message adheres to the msgContract of the feed
	 * @private 
	 * @param {object} msg  
	 */
	this._checkMsgContract = function(msg){
        var hasErrors = false;
        var hasNumberErrors = false;
        var msgJson = null;
        try{
             msgJson = ("string" == typeof(msg)) ? JSON.parse(msg) : msg;	
        }
        catch(e){
            hasErrors = true;
        }
        if (!!hasErrors || "object" != typeof(msgJson)) {
			return "Cannot parse message to JSON";
		} else {
			var errorFields = ""; 
			for (var index=0; index<this.feedSettings.msgContract.length; index++) {
				var contractKey = this.feedSettings.msgContract[index].fieldName;
				var hasContractKey = Object.prototype.hasOwnProperty.call(msgJson, contractKey);
				if (!hasContractKey) {
					return "Message incomplete";
				}
				var fieldType = this.feedSettings.msgContract[index].fieldType;
				if(fieldType == "N"){
					hasNumberErrors = false;
					if(isNaN(parseFloat(msgJson[contractKey]))){
						hasNumberErrors = true;
					}
					if(!!!hasNumberErrors){
						var validType = this.feedSettings.msgContract[index].validType;
						if(validType == 1){//Min Max Validation
							var data = parseFloat(msgJson[contractKey]);
							var min = !isNaN(parseFloat(this.feedSettings.msgContract[index].min)) ? parseFloat(this.feedSettings.msgContract[index].min) : null;
							var max = !isNaN(parseFloat(this.feedSettings.msgContract[index].max)) ? parseFloat(this.feedSettings.msgContract[index].max) : null;
							
							if(min != null){
								if(data < min)
									hasNumberErrors = true;
							}

							if(max != null){
								if(data > max)
									hasNumberErrors = true;
									
							}
						}
					}
					if(!!hasNumberErrors){
						errorFields += contractKey + ", ";
					}
				} else if(fieldType == "D"){
					var dateVal = msgJson[contractKey];
					var ts = new Date(dateVal).getTime();
					if(ts === "undefined" || ts === null || isNaN(ts) || ts === 0){
						errorFields += contractKey + ", ";
					} 
				} else if(fieldType == "S"){
					if(typeof (msgJson[contractKey]) == "object")
						errorFields += contractKey + ", ";
				}
			}
			if(!!!errorFields)
				return null;
			else{
				errorFields = errorFields.substring(0, errorFields.length -2);
				return "Fields with errors : " + errorFields;
			}
		}
	};

	/**
	 * Starts the active user cycle timer
	 * @private
	 * @param {BCC.Connection} connection
	 */
	this._activeUserCycle = function (connection) {
		var connection_closed, user_is_active, last_message_valid;

		connection_closed = (!connection || !connection.endpoint || connection.endpoint.isClosed());
		user_is_active = BCC.ContextInstance.isUserActive();
		last_message_valid= (this.lastMsg != null && this.lastMsg.feed != null);

		if (!connection_closed && user_is_active && last_message_valid) {
			BCC.Log.info("Active User Cycle In Progress." ,"BCC.FeedHandler._activeUserCycle");
			this.sendMsg(this.lastMsg.msg, this.lastMsg.feed, connection, true);
		} else {
			clearInterval(this.cycleHandler);
			this.cycleHandler = null;
			this.activeUserCycleInprogress = false;
			this.lastMsg = null;
			BCC.Log.info("Active User Cycle Expires" ,"BCC.FeedHandler._activeUserCycle");
		}
	};

	/**
	 * Converts the message(JSON) to a command (BCC.Command) 
	 * @private
	 * @param {object} msg 
	 * @param {BCC.Feed} feed
	 * @param {string} state INITIAL/UPDATE/REVOTE
	 */
	this._prepareCommand = function(msg, feed, state) {
		var msgJson = ("string" == typeof(msg)) ? JSON.parse(msg) : msg;
		
		var origMsg = {};
		for (var key in msgJson) {
			origMsg[key] = msgJson[key];
		}
		
		// manipulate the message guts when using active user feed
		try {
			var activeUserFields = this.feedSettings.activeUserFields;
			
			for (var index=0; index<this.feedSettings.msgContract.length; index++) {
				var contractKey = this.feedSettings.msgContract[index].fieldName;
				var hasContractKey = Object.prototype.hasOwnProperty.call(msgJson, contractKey);
				if (hasContractKey) {
					var isActiveField = false;
					for (var i in activeUserFields) {
						if(contractKey == activeUserFields[i]){
							isActiveField = true;
							break;
						}
					}
					if(isActiveField)
						continue;

					// fix dates
					var dt = this.feedSettings.msgContract[index].fieldType;
					if (dt == "D") {
						msgJson[contractKey] = new Date(msgJson[contractKey]).getTime();
					}
					 
					// test for dimension shift
					if (BCC.STATE_UPDATE == state) {
						var oldValue = this.lastMsg.msg[contractKey];
						var newValue = msgJson[contractKey];
						if (oldValue != newValue) {
							clearTimeout(this.cycleHandler);
							state = BCC.STATE_INITIAL;
						}
					}

				}
			}

			// adjust values if we are still doing an update
			if (BCC.STATE_UPDATE == state) {
				for (var k in activeUserFields) {
					var activeUserFieldName = activeUserFields[k];
					var msgHasProp = Object.hasOwnProperty.call(msgJson, activeUserFieldName);
					var lastMsgHasProp = Object.hasOwnProperty.call(this.lastMsg.msg, activeUserFieldName);
					
					if (msgHasProp && lastMsgHasProp) {
						msgJson[activeUserFieldName] = msgJson[activeUserFieldName] - this.lastMsg.msg[activeUserFieldName];
					}
				}
			}
		} catch(e){
			var msgError = new BCC.Event("onerror", BCC.EventDispatcher.getObjectKey(feed), "Message has errors. Not sent.");
			BCC.EventDispatcher.dispatch(msgError);
			return null;	// bail
		}
		
		// test write protection
		if (this.feedSettings.writeKeyFlag) {
			if (!feed.writeKey) {
				var writeKeyErrorMessage = "Feed is write protected, but write key was not assigned.  Message cannot be sent.";
				var writeKeyError = new BCC.Event("onerror", BCC.EventDispatcher.getObjectKey(feed), writeKeyErrorMessage);
				BCC.EventDispatcher.dispatch(writeKeyError);
				return null;	// bail
			}
		}
		
		this.lastMsg = this.lastMsg == null ? {} : this.lastMsg;
		this.lastMsg.msg = origMsg;
		this.lastMsg.feed = feed;
		
		var command = new BCC.Command("POST", "/feed/message/create.json", {
			"message" : msgJson
		});
		
		var md = {
			feedKey: feed.getFeedKey()
		};
		if (undefined !== state) {
			md.state = state;
		}
		if(state == BCC.STATE_UPDATE){
			md.utslot = this.lastMsg.ts;
		}
		if(feed.writeKey != null){
			md.writeKey = feed.writeKey;
		}

		command.addParam({ "metadata" : md });
		
		var me = this;
		command.onresponse = function(err){
			var response = typeof err == "string" ? JSON.parse(err) : err;
			if(response != null && response.tslot != null){
				if(state == BCC.STATE_INITIAL || state == BCC.STATE_REVOTE){
					me.lastMsg.ts = response.tslot;
					me.msgPending = false;
					me._popMsgQueue();
				}
			}
			var onmsgevt = new BCC.Event("onmsgsent", BCC.EventDispatcher.getObjectKey(feed), msgJson);
			BCC.EventDispatcher.dispatch(onmsgevt);
		};
		command.onerror = function(err) {
			var onerrorevent = new BCC.Event("onerror", BCC.EventDispatcher.getObjectKey(feed), err);
			BCC.EventDispatcher.dispatch(onerrorevent);
		};
		return command;
	};
	
	/**
	 * Pops and sends messages from the msgQueue
	 * @private
	 */
	this._popMsgQueue = function(){
		if(this.msgQueue.length > 0){
			for(var index in this.msgQueue){
				var msgObj = this.msgQueue[index];
				this.sendMsg(msgObj.msg, msgObj.feed, msgObj.conn, msgObj.cycleTriggered);
				BCC.Log.info("Message sent from queue : " + JSON.stringify(msgObj.msg),"BCC.FeedHandler._popMsgQueue");
			}
			this._clearMsgQueue();
		}
	};

	/**
	 * Identifies the state of the message  
	 * @private
	 * @param {boolean} cycleTriggered Flag that indicates if the method is invoked automatically as part of the active user cycle
	 * @returns {string} INITIAL/UPDATE/REVOTE
	 */
	this._getMsgState = function(cycleTriggered) {
		if (!this.feedSettings.activeUserFlag) {
			// without an active user flag, no such thing as 'state'
			return undefined;
		} else {
			// otherwise, figure it out based on cycle flags
			if (!this.activeUserCycleInprogress) {
				return BCC.STATE_INITIAL;
			} else {
				if (!!cycleTriggered) {
					return BCC.STATE_REVOTE;
				} else {
					return BCC.STATE_UPDATE;
				}
			}
		}
	};
};
//-----------------------------------------------------------------
// Copyright 2012 BrightContext Corporation
//
// Licensed under the MIT License defined in the 
// LICENSE file.  You may not use this file except in 
// compliance with the License.
//-----------------------------------------------------------------

BCC = ("undefined" == typeof(BCC)) ? {}: BCC;

/**
 * @class The object that stores the feed settings to avoid server fetching (if feed is already available)    
 * @constructor
 * @private
 */
BCC.FeedRegistry = function() {
	this.feedMap = null;

	/**
	 * Called by the constructor to initialize the object 
	 * @private
	 */
	this._init = function(){
		this.feedMap = {};
	};

	/**
	 * Returns all the feeds in the registry
	 */
	this.getAllFeeds = function(){
		var feedsArray = [];
		for(var key in this.feedMap){
			var feedObjects = this.feedMap[key].feedObjects;
			for(var objKey in feedObjects){
				feedsArray.push(feedObjects[objKey]);
			}
		}
		return feedsArray.length > 0 ? feedsArray : null; 
	};

	/**
	 * Returns all the unique feeds in the registry
	 */
	this.getAllUniqueFeeds = function(){
		var feedsArray = [];
		for(var key in this.feedMap){
			var feedObjects = this.feedMap[key].feedObjects;
			for(var objKey in feedObjects){
				feedsArray.push(feedObjects[objKey]);
				break;
			}
		}
		return feedsArray.length > 0 ? feedsArray : null;
	};
	
	/**
	 * Returns all the feeds with the same key as the feed in the registry
	 */
	this.getAllFeedsForKey = function(feed){
		var feedsArray = [];
		var fs = feed.getSettings();
		var key = this._generateKey(fs);
		var feedObjects = !!(this.feedMap[key]) ? this.feedMap[key].feedObjects : null;
		if(!!feedObjects){
			for(var objKey in feedObjects){
				feedsArray.push(feedObjects[objKey]);
			}
		}
		return feedsArray.length > 0 ? feedsArray : null;
	};

	/**
	 * Registers a feed. 
	 * If the feed item is not available in the map, a new feed item is created
	 * Otherwise the existing feed count is incremented
	 * @param {BCC.Feed} feed
	 */
	this.registerFeed = function(feed) {
		var fs = feed.getSettings();
		var key = this._generateKey(fs);
		if(this.feedMap[key] == null)
			this.feedMap[key] = new BCC.FeedRegistryItem(feed);
		else{
			feed.setHandler(this.feedMap[key].feedHandler);
			this.feedMap[key].addFeed(feed);
		}
	};
	/**
	 * Unregisters a feed. 
	 * If the feed item is available in the map, the feed count is decremented
	 * If the feed count is "0", the feedItem is removed from the map
	 *  
	 * @param {BCC.Feed} feed
	 */
	this.unRegisterFeed = function(feed) {
		var fs = feed.getSettings();
		var key = this._generateKey(fs);
		this.feedMap[key].removeFeed(feed);
		if(this.feedMap[key].getFeedCount() === 0)
			delete this.feedMap[key];
	};

	/**
	 * If the feed item is available in the map, the feed settings is returned
	 * @param {BCC.Feed} feed
	 */
	this.getLoadedFeed = function(feed) { // returns the feedSettings for a feed matching the feedkey of the feed that was passed in
		var fs = feed.getSettings();
		var key = this._generateKey(fs);
		if(this.feedMap != null && this.feedMap[key] != null)
			return this.feedMap[key].feedHandler.getSettings();
	};

	/** find a feed already registered with matching metadata */
	this.findFeedWithMetadata = function (feed_metadata) {
		var found_feed = null,
				i, j,
				feed_objects, feed;

		for(i in this.feedMap){
			feed_objects = this.feedMap[i].feedObjects;
			
			for(j in feed_objects) {
				feed = feed_objects[j];
				if (feed.hasMetadata(feed_metadata)) {
					found_feed = feed;
					break;
				}
			}

			if (found_feed) {
				break;
			}
		}

		return found_feed;
	};

	/**
	 * If the feed item is available in the map, the feed handler is returned
	 * @param {BCC.Feed} feed 
	 */
	this.getFeedHandler = function(feed) { // returns the feedSettings for a feed matching the feedkey of the feed that was passed in
		var fs = feed.getSettings();
		var key = this._generateKey(fs);
		if(this.feedMap != null && this.feedMap[key] != null)
			return this.feedMap[key].feedHandler;
	};

	/**
	 * Checks if the feed item is available in the map
	 * @param {BCC.Feed} feed
	 */
	this.feedExists = function(feed) { // checks if there is already a loaded feed matching this feed's feedkey 
		var fs = feed.getSettings();
		var key = this._generateKey(fs);
		return (this.feedMap[key] != null);
	};

	/**
	 * Returns the number of feed items available in the map
	 * @param {BCC.Feed} feed
	 */
	this.getFeedCount = function(feed) {
		var fs = feed.getSettings();
		var key = this._generateKey(fs);
		return this.feedMap[key].getFeedCount();
	};

	/**
	 * Checks if the FeedResistry is empty
	 */
	this.isEmpty = function() {
		var size = 0;
		for (var key in this.feedMap) {
			if (this.feedMap.hasOwnProperty(key)) size++;
		}
		return (size === 0);
	};

	/**
	 * Generate a unique key based on the procId and the filters
	 * @returns {string}
	 * @private
	 */
	this._generateKey = function(fs){
		var keyArray = [];
		var fk = "";
		for(var key in fs.filters){
			keyArray.push(key);
		}
		keyArray.sort();
		for(var index in keyArray){
			fk += keyArray[index] + fs.filters[keyArray[index]];
		}
		fk = fs.procId + fk;
		return fk;
	};

	this._init();
};

/**
 * The object that gets stored in the feedRegistry    
 * @constructor
 * @param {BCC.Feed} feed 
 * @private
 */
BCC.FeedRegistryItem = function(feed){
	this.count = 1;
	this.feedHandler = new BCC.FeedHandler(feed.getSettings());
	this.feedObjects = {};
	this.feedObjects[BCC.EventDispatcher.getObjectKey(feed)] = feed;
	feed.setHandler(this.feedHandler);

	/**
	 * Increments the feed count
	 */
	this.addFeed = function(feedObj){
		this.feedObjects[BCC.EventDispatcher.getObjectKey(feedObj)] = feedObj;
		this.count++;		
	};
	/**
	 * Decrements the feed count
	 */
	this.removeFeed = function(feedObj){
		delete this.feedObjects[BCC.EventDispatcher.getObjectKey(feedObj)];
		this.count--;
	};
	/**
	 * Returns the feed count
	 * @returns {int} count
	 */
	this.getFeedCount = function(){
		return this.count;
	};
};
//-----------------------------------------------------------------
// Copyright 2012 BrightContext Corporation
//
// Licensed under the MIT License defined in the 
// LICENSE file.  You may not use this file except in 
// compliance with the License.
//-----------------------------------------------------------------


/**
 * 
 * The primary namespace used by the BrightContext JavaScript SDK.
 * @namespace
 */
BCC = ("undefined" == typeof(BCC)) ? {}: BCC;

BCC.VERSION = "1.6.0";
BCC.BASE_URL = "http://pub.brightcontext.com/";
BCC.BASE_URL_SECURE = "https://pub.brightcontext.com/";
BCC.STATIC_URL = "http://static.brightcontext.com/pub/js/sdk";
BCC.STATIC_URL_SECURE = "https://static.brightcontext.com/pub/js/sdk";

BCC.JSON_LIB_PATH = "json2.min.js";															// json parse+stringify polyfill
BCC.FLASH_XHR_SWF_PATH = "flXHR.js";														// cors polyfill
BCC.SWF_OBJECT_LIB_PATH = "swfobject.js";												// cross-browser swfobject
BCC.FLASH_SOCKET_SWF_PATH = "web_socket.min.js";								// flash socket polyfill
BCC.FLASH_SOCKET_SWF_BINARY_PATH = "WebSocketMainInsecure.swf";	// flash binary for polyfill

/** True if the window global is available, otherwise false */
BCC.HAS_WINDOW = ('undefined' !== typeof(window));

BCC.AJAX_INITIALIZING = 0;
BCC.AJAX_READY = 1;
BCC.AJAX_IN_PROGRESS = 2;
BCC.AJAX_DONE = 3;

BCC.SESSION_NAME = "bcc_so";

BCC.MAX_SESSION_ATTEMPTS = 3;
BCC.MAX_ENDPOINT_ATTEMPTS = 3;

/**
 * @namespace BCC.LogLevel
 * @description Constants for system log levels
 * @see BCC#setLogLevel
 * @example
 *   // log only errors and warnings to console
 *   BCC.setLogLevel(BCC.LogLevel.WARN);
 */
BCC.LogLevel = {};
/** No logging */
BCC.LogLevel.NONE = 0;
/** Log errors only */
BCC.LogLevel.ERROR = 1;
/** Log warnings and errors */
BCC.LogLevel.WARN = 2;
/** Log information, warnings, and errors */
BCC.LogLevel.INFO = 3;
/** Log all information */
BCC.LogLevel.DEBUG = 4;

/** Current log level
 * @private
 */
BCC.CURRENT_LOG_LEVEL = BCC.LogLevel.ERROR;

/**
 * Returns the current system log level.
 * @see BCC.LogLevel
 * @private
 */
BCC.getLogLevel = function() {
	return BCC.CURRENT_LOG_LEVEL;
};

/**
 * Sets the log level to DEBUG, INFO, WARN, ERROR, or NONE.
 * @see BCC.LogLevel
 */
BCC.setLogLevel = function(level) {
	BCC.CURRENT_LOG_LEVEL = level;

	if (BCC.HAS_WINDOW) {
		if (BCC.LogLevel.DEBUG == level) {
			window.WEB_SOCKET_DEBUG = true;
		} else {
			window.WEB_SOCKET_DEBUG = false;
		}
	}
};

BCC.STATE_INITIAL = "INITIAL";
BCC.STATE_REVOTE = "REVOTE";
BCC.STATE_UPDATE = "UPDATE";

BCC.HEART_BEAT_STRING = '{ "cmd": "heartbeat" }';

BCC.API_COMMAND_ROOT = "/api/v2";

/**
 * @private
 * @namespace
 */
BCC.Log = {};

/**
 * Global BCC method to log info to the browser console
 * @param {string} msg
 * @param {string} path
 */
BCC.Log.info = function(msg, path) {
	if (BCC.CURRENT_LOG_LEVEL >= BCC.LogLevel.INFO) {
		// write to a console
		if ('undefined' !== typeof(console))
			console.info("BCC Info : " + path + " : " + msg);
	}
};

/**
 * Global BCC method to log debug to the browser console
 * @param {string} msg
 * @param {string} path
 */
BCC.Log.debug = function(msg, path) {
	if (BCC.CURRENT_LOG_LEVEL >= BCC.LogLevel.DEBUG) {
		// write to a console
		if ('undefined' !== typeof(console))
			console.log("BCC Debug : " + path + " : " + msg);
	}
};

/**
 * Global BCC method to log error to the browser console
 * @param {string} msg
 * @param {string} path
 */
BCC.Log.error = function(msg, path) {
	if (BCC.CURRENT_LOG_LEVEL >= BCC.LogLevel.ERROR) {
		// write to a console
		if ('undefined' !== typeof(console))
			console.error("BCC Error : " + path + " : " + msg);
	}
};

BCC.Log.warn = BCC.Log.error;
BCC.Log.log = BCC.Log.debug;

if (BCC.HAS_WINDOW) {
	window.WEB_SOCKET_LOGGER = BCC.Log;	// flash socket global logging override
}

/**
 * @private
 * @namespace
 */
BCC.Util = {};

/**
 * Checks if the value is available in the array
 * @param {string} value
 * @param {Array} array
 * @returns {boolean}
 */
BCC.Util.valueInArray = function(value, array){
	for(var index in array){
		if(array[index] == value) return true;
	}
	return false;
};

/**
 * String Trim
 * @param {string} str
 * @returns {string}
 */
BCC.Util.trim = function(str) {
	return str.replace(/^\s+|\s+$/g, ''); 
};

/**
 * getBccUrl
 * @param {string} str
 * @returns {string}
 */
BCC.Util.getBccUrl = function(restUrl, urlPath) {
	var len = restUrl.length;
	if(restUrl.charAt(len-1) == "/"){
		if(urlPath.charAt(0) == "/"){
			return restUrl.substr(0, len-1) + urlPath; 
		} else {
			return restUrl + urlPath;
		}
	} else {
		if(urlPath.charAt(0) == "/"){
			return restUrl + urlPath; 
		} else {
			return restUrl + "/" + urlPath;
		}
	}
};

BCC.Util.isFn = function (f) {
	return ('function' === typeof(f));
};

BCC.Util.injectScript = function (script_src, completion) {
	var script_element,
			head_element,
			complete;

	complete = function (error) {
		if ('function' === typeof(completion)) {
			completion(error);
		}
	};

	script_element = document.createElement('SCRIPT');
	script_element.type = 'text/javascript';
	script_element.src = script_src;
	script_element.async = true;

	script_element.onreadystatechange = function() {
		if (this.readyState == 'loaded' || this.readyState == 'complete') {
			complete();
		}
	};

	if (script_element.readyState == null) {
    script_element.onload = function() {
			complete();
    };
    script_element.onerror = function(error_object) {
			complete(error_object);
    };
	}

	head_element = document.getElementsByTagName('HEAD');
	if (head_element[0] != null) {
    head_element[0].appendChild(script_element);
	}

	return script_element;
};

/**
 * makes a cross-browser compatible, cross-origin domain friendly http request
 * @example
 * var xhr = BCC.Util.makeRequest({
 *   url: 'http://brightcontext.com/api/v2/...'
 *   method: 'GET',	// default is POST
 *   data: {}, // object to be sent as post data, or undefined
 *   onprogress: function(data) { },
 *   onload: function(response) { },
 *   onerror: function(error) { }
 * });
 */
BCC.Util.makeRequest = function (params) {
	BCC.Log.debug(JSON.stringify(params), 'BCC.Util.makeRequest');

	var method = params.method || "POST",
			xhr = new BCC.Ajax();

	if (BCC.Util.isFn(params.onprogress)) {
	  xhr.onprogress = function () {
			params.onprogress(xhr.getResponseText());
	  };
	}
	
	if (BCC.Util.isFn(params.onload)) {
		xhr.onload = function () {
			params.onload(xhr.getResponseText());
		};
	}
	
	if (BCC.Util.isFn(params.onerror)) {
		xhr.onerror = function () {
			params.onerror(xhr.getResponseText());
		};
	}
	
	xhr.open(method, params.url, true);

	if ('POST' === method) {
		if ('object' === typeof(params.headers)) {
			xhr.setHeaders(params.headers);
		} else {
			xhr.setHeaders({
				'Content-Type' : 'application/x-www-form-urlencoded'
			});
		}
	}

	var payload = params.data;
	if ('object' === typeof(payload)) {
		payload = JSON.stringify(payload);
	}
	xhr.send(payload);
	
	return xhr;
};

BCC.Util.Metrics = function () {
	var _m = {};

	this.inc = function (k, v) {
		var value = (v) ? v : 1;

		if ('undefined' === typeof(_m[k])) {
			_m[k] = value;
		} else {
			_m[k] = _m[k] + value;
		}

		return _m[k];
	};

	this.dec = function (k) {
		return this.inc(k, -1);
	};

	this.set = function (k, v) {
		_m[k] = v;
		return _m[k];
	};

	this.get = function (k) {
		if ('undefined' == typeof(_m[k])) {
			_m[k] = 0;
		}
		return _m[k];
	};

	this.print = function (prefix) {
		BCC.Log.debug(JSON.stringify(_m), prefix);
	};
};

/**
 * Single place to hold browser checks for various capabilities
 * @private
 */
BCC.Env = {};

BCC.Env.IS_SECURE = ((BCC.HAS_WINDOW) && (!!window.location.href.match(/^https/)));
BCC.Env.FORCE_WEBSOCKETS_OFF = false;
BCC.Env.FORCE_FLASHSOCKETS_OFF = false;
BCC.Env.FORCE_STREAMING_OFF = false;
BCC.Env.FORCE_FLASHGATEWAY_OFF = false;

BCC.Env.checkWebSocket = function (completion) {
	if (BCC.Env.FORCE_WEBSOCKETS_OFF) {
		completion('websockets forced off');
	} else {

		if (!BCC.WebSocket) {
			if ('undefined' !== typeof(window)) {
				BCC.WebSocket = (window.WebSocket || window.MozWebSocket);
			}
		}

		var ok = (!!BCC.WebSocket);
		completion(ok ? null : 'websocket not supported');
	}
};

BCC.Env.checkFlashSocket = function (completion) {
	if (BCC.Env.FORCE_FLASHSOCKETS_OFF) {
		completion('flashsockets forced off');
	} else {

		if ('undefined' == typeof(swfobject)) {
			BCC.Util.injectScript(BCC.Env.pathToLib(BCC.SWF_OBJECT_LIB_PATH), function (swf_load_error) {
				if (swf_load_error) {
					completion(swf_load_error);
				} else {
					var ok = (swfobject.getFlashPlayerVersion().major >= 10);
					if (!ok) {
						completion('flash version too old');
					} else {
						completion(null, swfobject);
					}
				}
			});
		} else {
			completion(null, swfobject);
		}

	}
};

BCC.Env.checkStreaming = function (completion) {
	if (BCC.Env.FORCE_STREAMING_OFF) {
		completion('streaming forced off');
	} else {
		completion(null);
	}
};

BCC.Env.checkFlashGateway = function (completion) {
	if (BCC.Env.FORCE_FLASHGATEWAY_OFF) {
		completion('flash gateway backup forced off');
	} else {
		completion(null);
	}
};

BCC.Env.pathToLib = function (filename) {
	var prefix, path;
	prefix = (BCC.Env.IS_SECURE) ? BCC.STATIC_URL_SECURE : BCC.STATIC_URL;
	path = prefix + '/lib/' + filename;
	return path;
};

BCC.Env.baseActionPath = function (url) {
	var m = url.match(/https?:\/\/.*?\//);
	if (1 == m.length) {
		return m[0];
	} else {
		return null;
	}
};


BCC.Env.flipToNativeWebSocket = function () {
	if (BCC.HAS_WINDOW) {
		window.WEB_SOCKET_FORCE_FLASH = false;

		if (window.WebSocket) {
			if (window.WebSocket.__flash) {
				window.FlashWebSocket = window.WebSocket;
				window.WebSocket = BCC.WebSocket;
			}
		}
	}
};

BCC.Env.flipToFlashWebSocket = function () {
	if (BCC.HAS_WINDOW) {
		window.WEB_SOCKET_FORCE_FLASH = true;
		window.WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR = true;
		window.WEB_SOCKET_SWF_LOCATION = BCC.Env.pathToLib(BCC.FLASH_SOCKET_SWF_BINARY_PATH);

		if (window.FlashWebSocket) {
			window.WebSocket = window.FlashWebSocket;
		}
	}
};

// exports
if (('undefined' !== typeof(module)) && ('undefined' !== typeof(module.exports))) {
	module.exports = BCC;
}
//-----------------------------------------------------------------
// Copyright 2012 BrightContext Corporation
//
// Licensed under the MIT License defined in the 
// LICENSE file.  You may not use this file except in 
// compliance with the License.
//-----------------------------------------------------------------

BCC = ("undefined" == typeof(BCC)) ? {}: BCC;

/**
 * @class Represents a single Project in the management console which contains Channels and Feeds.
 * Used to inspect Channel metadata and open Feeds of any type.
 * @constructor
 * @param {string} project_name Name of the project as defined in the management console.
 * @description
 * Project objects should not be created manually, but instead opened using an initialized context.
 * @see BCC
 * @see BCC.Context#project
 * @example
 * var ctx = BCC.init('apikey');
 * var p = ctx.project('project name');
 * p.feed({
 *  // settings obj
 * });
 */
BCC.Project = function(project_name) {
	var me = this;

	this._project_name = project_name;
	this._channelMetadataCache = {};

	/**
	 * Used to open any feed with a single line of code using a settings object.
	 * Fetches channel meta-data if needed, and opens the feed automatically unless otherwise specified.
	 *
	 * @param {object} fd - settings object with the following properties:
	 * <ul>
	 *  <li>channel</li>
	 *  <li>name</li>
	 *  <li>filter</li>
	 *  <li>writekey</li>
	 *  <li>onopen</li>
	 *  <li>onclose</li>
	 *  <li>onmsgreceived</li>
	 *  <li>onmsgsent</li>
	 *  <li>onhistory</li>
	 *  <li>onerror</li>
	 * </ul>
	 *
	 * <p><strong>channel</strong> - <em>string</em> - <strong>Required</strong> - Name of the channel as defined in the management console.</p>
	 * <p><strong>name</strong>  - <em>string</em> - Varies depending on channel type</p>
	 * <p>For QuantChannels: <strong>Required</strong>.  This is the name of the Input or the Output that was created using the management console.</p>  
	 * <p>For ThruChannels: <strong>Optional</strong>. This can be any string to describe a sub-channel where any other traffic will be squelched.
	 * For example, if you had a lobby on a ThruChannel, this could be used to create private rooms apart from the main lobby.
	 * If not provided, the default sub-channel used is 'default'.
	 * </p>
	 * <p><strong>filter</strong> - <em>object</em> - Varies depending on feed configuration</p>
	 * <p>This is only required on QuantChannel Outputs when runtime parameter filtering is used.</p>
	 * <p>An object with one string key per filter parameter configured should be provided.
	 * For example, if the feed is an Output feed configured to take <code>lat</code> and <code>long</code> run time parameters,
	 * the object passed here should look like this <code>{ "lat": 37.332136, "long": -122.027829 }</code>.</p>
	 * <p>This is not required for Outputs that are configured to use filtering but take none of the filters as runtime parameters.
	 * This is also not required for Inputs or any other channel types, and should be left undefined unless required.
	 * Providing a filter when one is not required, or providing an improper or incomplete filter definition
	 * on feeds that do require one will fire BCC.Feed.onerror event handlers when attempting to open because the filter provided
	 * does not match what was defined.
	 * </p>
	 * <p><strong>writeKey</strong> - <em>string</em> - Varies depending on feed configuration</p>
	 * Write keys are off by default on feeds and need to be enabled using the management console.
	 * When turned on, this should be set to the write key that is generated.
	 * Using write keys is an easy way to provide public, <em>read-only</em> access to real time feeds
	 * and build a separate app that has <em>read-write</em> access to the same real time feeds.
	 * If a write key is not provided on feeds requiring one, the feeds will still open and provide data, but will not be writable.
	 * Only provide write keys on write key enabled feeds when writing will be done, and keep them out of your code otherwise.</p>
	 *
	 * <p><em>Feed event handlers<em></p>
	 * <p><strong>onopen</strong> - <em>function</em> - <strong>Optional</strong> - BCC.Feed.onopen handler</p>
	 * <p><strong>onclose</strong> - <em>function</em> - <strong>Optional</strong> - BCC.Feed.onclose handler</p>
	 * <p><strong>onmsgreceived</strong> - <em>function</em> - <strong>Optional</strong> - BCC.Feed.onmsgreceived handler</p>
	 * <p><strong>onmsgsent</strong> - <em>function</em> - <strong>Optional</strong> - BCC.Feed.onmsgsent handler</p>
	 * <p><strong>onhistory</strong> - <em>function</em> - <strong>Optional</strong> - BCC.Feed.onhistory handler</p>
	 * <p><strong>onerror</strong> - <em>function</em> - <strong>Optional</strong> - BCC.Feed.onerror handler</p>
	 * 
	 * @returns feed object that will be ready in the future, after it has been opened.
	 * Listen for the <code>onopen</code> event to know when the feed returned is ready to use.
	 * 
	 * @see BCC.Feed
	 *
	 * @example
	 * 
	 * // initialize context and get a handle to the current project
	 * var p = BCC.init('my api key').project('my project name');
	 * 
	 * // sequester a channel and open the feed.
	 * // the my_feed here is the same object as feed passed to each event handler
	 * // the feed will not be ready to use until the onopen event has fired
	 * var my_feed = p.feed({
	 *   channel: 'my channel name',
	 *   name: 'name of input or output', // can be left undefined when using a ThruChannel
	 *   filter: { optional filter object }, // one key/value pair for each server filter configured
	 *   writeKey: 'optional write key',	// leave it undefined unless you have one
	 *   onopen: function(feed) {
	 *    // feed ready for use
	 *    // can now do things like feed.send() or feed.history()
	 *   },
	 *   onclose: function(feed) {
	 *    // feed no longer available
	 *   },
	 *   onmsgreceived: function(feed, message) {
	 *    // new message was broadcasted
	 *   },
	 *   onmsgsent: function(feed, message) {
	 *    // message was sent successfully
	 *   },
	 *   onhistory: function(feed, history) {
	 *    // history is an array of feed messages that was requested by feed.history(...)
	 *   },
	 *   onerror: function(error) {
	 *    // error describing what went wrong, might be a string or object
	 *   }
	 * });
	 *
	 * // when finished with a data stream call feed.close()
	 * 
	 */
	this.feed = function(fd) {
		// bail if no listener was passed in
		if ('object' != typeof(fd)) return null;

		var f, wk, notify_error;

		notify_error = function (error_message) {
			if (fd) {
				if (BCC.Util.isFn(fd.onerror)) {
					fd.onerror(error_message);
				}
			}
		};

		// error on invalid project name
		if ('string' != typeof(me._project_name) || '' === me._project_name) {
			notify_error('invalid project name: ' + me._project_name);
			return;
		}

		// error on invalid channel name
		if ('string' != typeof(fd.channel) || '' === fd.channel) {
			notify_error('invalid channel name');
			return;
		}

		// support for both mixed case and all lowercase write key parameter
		if ("string" === typeof(fd.writeKey)) {
		  wk = fd.writeKey;
		} else if ("string" === typeof(fd.writekey)) {
		  wk = fd.writekey;
		}

		// make feed
		f = new BCC.Feed({
			project: me._project_name,
			channel: fd.channel,
			connector: fd.name || BCC.Feed.DEFAULT_FEED_NAME,
			filters: fd.filter
		}, wk);

		// event wiring
		
		
		if (BCC.Util.isFn(fd.onerror)) {
		  f.onerror = fd.onerror;
		}

		f.onhistory = function(h) {
			if (BCC.Util.isFn(fd.onhistory)) {
				fd.onhistory(f, h);
			}
		};

		f.onmsgreceived = function(msg) {
			if (BCC.Util.isFn(fd.onmsgreceived)) {
				fd.onmsgreceived(f, msg);
			}
		};

		f.onmsgsent = function(msg) {
			if (BCC.Util.isFn(fd.onmsgsent)) {
				fd.onmsgsent(f, msg);
			}
		};

		f.onclose = function(closedFeed) {
			if (BCC.Util.isFn(fd.onclose)) {
				fd.onclose(closedFeed);
			}
		};

		// open
		BCC.ContextInstance.openFeed(f, function (open_error) {
			if (open_error) {
				BCC.Log.error('failed to open feed ' + f.shortDescription() + ' : ' + JSON.stringify(open_error), 'BCC.Project.feed');

				if (BCC.Util.isFn(fd.onerror)) {
				  fd.onerror(open_error);
				}
			} else {
				if (BCC.Util.isFn(fd.onopen)) {
				  fd.onopen(f);
				}
			}
		});

		return f;
	};

	/**
	 * Retrieve channel metadata
	 * @param {string} channelName Name of the channel as defined in the management console.
	 * @param {function} callback
	 * <p><strong>Optional</strong> Callback fired when complete with the following message signature:
	 * <code>function(channel, error)</code></p>
	 * <p><em>channel</em> is a BCC.Channel object with all the information about the channel as defined by the management console</p>
	 * <p><em>error</em> is null on success, otherwise the error encountered</p>
	 * @see BCC.Channel
	 * @example
	 * var p = BCC.init('my api key').project('my project name');
	 * 
	 * p.channel('channel name', function(chan, err) {
	 *   if (!err) {
	 *     // use chan
	 *   }
	 * });
	 */
	this.channel = function(channelName, callback) {
		var cachedMd = me._channelMetadataCache[channelName];
		if ("undefined" !== typeof(cachedMd)) {
			if ("function" == typeof(callback)) {
			  callback(cachedMd, null);
	  }
		} else {
			if ("string" != typeof(channelName)) return;
			if ("string" != typeof(me._project_name)) return;

			var getChannel = new BCC.Command("GET", "/channel/description.json", {
				name: channelName,
				project: me._project_name
			});

			if ("function" == typeof(callback)) {
				getChannel.onresponse = function(msg) {
					cachedMd = new BCC.Channel(msg);
					me._channelMetadataCache[channelName] = cachedMd;
					callback(cachedMd, null);
				};
				getChannel.onerror = function(err) {
					callback(null, err);
				};
			}

			BCC.ContextInstance.sendCommand(getChannel);
		}
	};

	// this._init = function() {
	// }
	// this._init();
};

//-----------------------------------------------------------------
// Copyright 2012 BrightContext Corporation
//
// Licensed under the MIT License defined in the 
// LICENSE file.  You may not use this file except in 
// compliance with the License.
//-----------------------------------------------------------------

BCC = ("undefined" == typeof(BCC)) ? {}: BCC;

/**
 * @class The object that holds the user session info
 * @constructor
 * @param {string} apiKey
 * @private
 */
BCC.Session = function(apiKey) {
	var me = this;

	this.apiKey = apiKey;
	this.session_data = null;

	/**
	 * Called by the constructor to initialize the object 
	 * @private
	 */
	this._init = function(){
		if ((this.apiKey == null) || (BCC.Util.trim(this.apiKey) === "")) {
			BCC.Log.error("API Key missing.","BCC.Session.constructor");
			return;
		}
	};

	/**
	 * Opens the session
	 */
	this.create = function (completion) {
		me._injectJsonLibIfNeeded(function (json_inject_error) {
			if (json_inject_error) {
				completion(json_inject_error);
			} else {
				me._establishNewSession(function (establish_error, session_data) {
					if (establish_error) {
						completion(establish_error);
					} else {
						BCC.Log.debug(JSON.stringify(session_data), 'BCC.Session.create');
						me.session_data = session_data;
						completion(null, me);
					}
				});
			}
		});
	};
	
	this._establishNewSession = function (completion) {
		BCC.Util.makeRequest({
			url: me.getSessionCreateUrl(),
			method: 'POST',
			data: 'apiKey=' + apiKey,
			onload: function (response) {
				if (response) {
					completion(null, JSON.parse(response));
				} else {
					completion('invalid session object');
				}
			},
			onerror: function (error) {
				completion(error || 'error establishing session');
			}
		});
	};

	this._injectJsonLibIfNeeded = function(completion) {
		if ('undefined' == typeof(JSON)) {
			BCC.Util.injectScript(BCC.Env.pathToLib(BCC.JSON_LIB_PATH), function (error) {
				completion(error);
			});
		} else {
			completion(null);
		}
	};

	this.hasValidSession = function() {
		var valid = (("undefined" != typeof(this.session_data)) &&
					 (null !== this.session_data) &&
					 ("undefined" == typeof(this.session_data.error)));
		return valid;
	};

	/**
	 * Adds a property (key value pair) to the session_data JSON and then to the cookie
	 * @param {string} key
	 * @param {string} value
	 */
	this.addProperty = function(key, value) {
		this.session_data[key] = value;
	};

	/**
	 * Returns the session_data JSON
	 * @returns {JSON} session_data
	 */
	this.getProperties = function() {
		return this.session_data;
	};

	/**
	 * Returns the session Id
	 * @returns {string} sid
	 */
	this.getSessionId = function() { 
		return this.session_data.sid; 
	};

	/**
	 * Get the usable server endpoints for this session
	 * @returns {object} endpoints object
	 * @example
	 * {
	 *  "sid": "fed0cef4-34df-456d-87c1-f7d3e6f28aa0",
   *  "stime": 1351281307094,
   *  "endpoints": {
   *      "flash": [
   *          "ws://...",
   *          "ws://...:8080"
   *      ],
   *      "socket": [
   *          "ws://...",
   *          "ws://...:8080"
   *      ],
   *      "rest": [
   *          "http://..."
   *      ]
   *  },
   *  "ssl": false
	 * }
	 */
	this.getEndpoints = function () {
		return this.session_data.endpoints;
	};

	/**
	 * Get the security flag of the session
	 * @returns true if TLS is available, false otherwise
	 */
	this.isSecure = function () {
		return this.session_data.ssl;
	};

	this.getSessionCreateUrl = function () {
		var prefix, url;
		prefix = (BCC.Env.IS_SECURE) ? BCC.BASE_URL_SECURE : BCC.BASE_URL;
		url = BCC.Util.getBccUrl(prefix, BCC.API_COMMAND_ROOT + '/session/create.json');
		return url;
	};

	/**
	 * Returns the socket url
	 * @returns {string}
	 */
	this.getSocketUrl = function (u) {
		var socketUrl = u.replace(/\/$/,'') + BCC.API_COMMAND_ROOT + "/feed/ws";
		return socketUrl;
	};

	/**
	 * Returns the Web Streaming url
	 * @returns {string}
	 */
	this.getStreamUrl = function (u) { 
		var streamUrl = u.replace(/\/$/,'') + BCC.API_COMMAND_ROOT + "/stream/create.json";
		return streamUrl;
	};

	this._init();
};
//-----------------------------------------------------------------
// Copyright 2012 BrightContext Corporation
//
// Licensed under the MIT License defined in the 
// LICENSE file.  You may not use this file except in 
// compliance with the License.
//-----------------------------------------------------------------

BCC = ("undefined" == typeof(BCC)) ? {}: BCC;

/**
 * @class Parses the incoming feed messages and convers them to JSON
 * @constructor
 * @param {function} cb Callback function that handles individual JSONs
 * @private
 */
BCC.StreamTokenizer = function (cb) {
	this.sanitizerCallback = 0;
	this.bufferPointer = 0;

	/**
	 * Called by the constructor to initialize the object
	 * @private
	 */
	this._init = function(){
		this.resetBuffer();
		this.setCallback(cb);
	};

	/**
	 * Resets the buffer with the last dispatched index
	 * @param {int} statementEndIndex
	 */
	this.resetBuffer = function(statementEndIndex) {
		var end = statementEndIndex || 0;
		if (0 !== end) {
			this.buffer = this.buffer.substring(statementEndIndex);
		} else {
			this.buffer = "";
		}
	};
	
	/**
	 * Sets the callback function
	 * @param {function} cb Callback function
	 */
	this.setCallback = function(cb) {
		this.callback = cb;
	};

	/**
	 * Sets the sanitizer function
	 * @param {function} s sanitizer function
	 */
	this.setSanitizer = function(s) {
		this.sanitizerCallback = s;
	};

	/**
	 * Appends data to the buffer
	 * @param {string} d
	 */
	this.appendData = function(d) {
		this.buffer += d;
		this.analyzeBufferData();
	};

	/**
	 * Parses and dispatches JSONs from the buffer
	 */
	this.analyzeBufferData = function() {
		var jsonStartIndex = 0,
				jsonEndIndex = 0,
				blockCounter = 0;

		for (var i=0; i < this.buffer.length; ++i) {
			var c = this.buffer[i];
			if (c == '{') {
				if (0 === blockCounter) {
					jsonStartIndex = i;
				}
				++blockCounter;
			} else if (c == '}') {
				--blockCounter;
				if (0 === blockCounter) {
					jsonEndIndex = i + 1;
					this.handleCompleteMessage(jsonStartIndex, jsonEndIndex);
				} else if (0 > blockCounter) {
					BCC.Log.error("Invalid data stream, buffer reset","BCC.StreamTokenizer.analyzeBufferData");
					this.resetBuffer();
				}
			}
		}
		
		if (0 !== jsonEndIndex) {
			this.resetBuffer(jsonEndIndex);
		}
	};

	/**
	 * Dispatches a JSON to the callback function
	 * @param {int} jsonStartIndex
	 * @param {int} jsonEndIndex
	 */
	this.handleCompleteMessage = function(jsonStartIndex, jsonEndIndex) {
		try {
			var payload = this.buffer.substring(jsonStartIndex, jsonEndIndex);

			if (typeof(this.sanitizerCallback) == 'function') {
				payload = this.sanitizerCallback(payload);
			}

			var o; 
			eval("o="+payload);
			if (typeof(o) == "undefined") {
				BCC.Log.error("Unable to evaluate object from payload","BCC.StreamTokenizer.handleCompleteMessage");
			} else {
				this.callback(o, this);
			}
		} catch (ex) {
			this.resetBuffer();
		}
	};
	
	this._init();
};
