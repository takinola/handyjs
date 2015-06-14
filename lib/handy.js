/*
 * Main module for handy.js.
 * It sets up the app settings and initializes the app
 */
'use strict';

var express = require('express')
  , compression = require('compression')
  , cookieParser = require('cookie-parser')
  , session = require('express-session')
  , favicon = require('serve-favicon')
  , bodyParser = require('body-parser')
  , methodOverride = require('method-override')
  , csrf = require('csurf')
  , morgan = require('morgan')
  , http = require('http')
  , path = require('path')
  , fs = require('fs')
  , RedisStore = require('connect-redis')(session)
  , utility = require('./utility')
  , system = require('./system')
  , bootstrap = require('./bootstrap')
  , content = require('./content')
  , user = require('./user')
  ;

var app = module.exports = express();

var handyDirectory = system.findHandyDirectory();
app.set('handyDirectory', handyDirectory);


// make the various Handy modules available through app.set
var handyObj = {
  utility: utility,
  system: system,
  bootstrap: bootstrap,
  content: content,
  user: user,
  RedisStore: RedisStore
};
app.set('handy', handyObj);

var secretStrings = system.secretStrings;  // object containing random strings used for secret keys, redis db prefix, etc

var sessionStore = new RedisStore({host: 'localhost', port: 6379, db:1, prefix: secretStrings.redisPrefix});
sessionStore.on('disconnect', function(){
  console.log('Redis connection lost...');
});

sessionStore.on('connect', function(){
  console.log('Redis connection established...');
});

// all environments
app.use(compression()); // gzips responses

// set project specific express configuration
/* for security reasons, nodejs should only listen to ports above 1000
 * (assuming, of course, nodejs is running behind a reverse proxy)
 * this is because only users (system users, that is) with root access
 * can run services that bind to ports under 1000.  Node should not be
 * run by a user with root access, so the only ports available are above 1000
 */
var defaultPort = 2000;
// set environment variable PORT appropriately for sites hosted on the same server
app.set('port', process.env.PORT || defaultPort);

app.set('views', path.join(handyDirectory, 'views'));
app.set('view engine', 'jade');

app.use(morgan('dev'));

//var cookieSecret = Math.random().toString(36).slice(-8);
var cookieSecret = secretStrings.cookieSecret;
app.use(cookieParser(cookieSecret));  // do we lose all previous cookies each time the server starts?

app.use(express.static(path.join(handyDirectory, 'public')));  // set up public directory

// store session data in redis
app.use(session({
  store: sessionStore,
  secret: secretStrings.sessionSecret,
}));

// set up favicon
//app.use(favicon(path.join(handyDirectory, '/public/img/favicon.ico')));

//app.use(express.bodyParser()); // enables access to form content via req.body
// the next two lines are a replacement for the bodyParser line above
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());

// needs to be before any module that needs to know the method of a request e.g. csurf
app.use(methodOverride());

// create csrf for each request.  needs to be after session middleware or cookie-parser
app.use(csrf());

// middleware to set csrf token to be used in forms
app.use(function(req, res, next){
  res.locals.token = req.csrfToken();
  next();
});

/* enable handy to run behind a proxy e.g. Nginx.
 * comment this out if using node as a direct server
 */
app.enable('trust proxy');

// middleware to set req.session.user.id to zero for unauthenticated users
app.use(function(req, res, next){
  req.session.user = req.session.user || {};
  req.session.user.id = req.session.user.id || 0;
  next();
});

// middleware to set system message warning logged in but unverified users to verify their accounts
app.use(function(req, res, next){
  if(req.session.user.id > 0 && !req.session.user.verified){
    system.systemMessage.set(req, 'warning', 'Your email needs to be verified.  Until you verify your email address, there may be some content or functionality that is inaccessible to you.  <br/>Please click on the verification link in the email sent to you or <a class="alert-link" href="/requestverificationemail?type=email&email=' + encodeURIComponent(req.session.user.email) + '">request another verification email</a> be sent to you');
  }
  next();
});

// middleware to retrieve system messages - place close to the last so that it picks up all system messages
app.use(function(req, res, next){
  var msg = system.systemMessage.get(req);
  if(msg){
    res.locals.sysmessage = msg;
  } else {
    res.locals.sysmessage = {};
  }
  next();
});

var routes = require(path.join(handyDirectory, 'routes'))(app); // place this just above app.use(app.router) as app.router is really invoked as soon as the first app.get is encountered in the imported file 

/*
 * Error handler (used by Handy.js routes only)
 * Note: to use the system.errorHandler API, the following views need to be defined in your project
 *       "403accessdenied.jade" and "500internalerror.jade"
 *        there is an example of each of these files in /handy/views
 */
app.use(function(err, req, res, next){
  system.errorHandler(err, req, res, next);
});

app.set('app', app);

// not used when handy is a submodule
var server = function(){
  http.createServer(app).listen(app.get('port'), function(){
      console.log('Express server listening on port ' + app.get('port'));
    });   
};

app.set('server', server);
