Readme.md

# Handyjs

# Contents
* [Introduction](#introduction)
* [Features](#features)
* [Dependencies](#dependencies)
* [Getting Started](#getting-started)
* [API Documentation](#api-docs)
* [How Handyjs works](#handy-works)
* [License](#license)
* [Credits](#credits)

## Introduction <a name='introduction'></a>
Handyjs is a web application template for building Nodejs applications.  Handyjs provides the basic functionality that almost all web apps need e.g. user account management, setting cron tasks, managing content or access control.  By using Handyjs, you can focus your development time more on the features that make your web application truly unique and less on creating generic, but necessary, functionality.  Handyjs also offers the advantage of offloading critical but easy to get wrong functionality like password management and access control so you can be sure your application is built on current best practice.

---

## Features <a name='features'></a>

### User account management

#### Account registration
Users can register accounts in order to gain privileges on your web app.  The conditions under which a user can create an account is governed by rules set by the site administrator.  Administrators can allow any visitor to create an account or require new accounts to obtain administrator approval prior to becoming active.  Administrators can also set customized emails to be sent automatically to users upon registration.  This can be anything from a simple welcome message to an email verification link.

Accounts can also be created for third parties by administrators.

(learn more about [account registration](#account-registration-link))

#### Email verification
Administrators can require newly registered users to verify their email addresses by sending an email verification link to the email address used for registration.  The user account is not considered verified until the user follows the email verification link as proof that they have access to the emaila address used for registration.  The site administrators have the option to set restrictions on the functionality available to newly registered users until their email addresses are verified (e.g. comments or posts are not published until user accounts are verified)

(learn more about [email verification](#email-verification-link))

#### User profile management
Users have profile pages where the information about their accounts can be displayed and modified.  Users have the option to change their usernames, email addresses, etc

(learn more about [user profile management](#profile-management-link))

#### Password modification
Users can change their passwords either through their profile pages or by requesting a password reset (in the event they have forgotten their password and are unable to login to the site).  To request a password reset, the user simply enters the email address associated with their account and receives an email with a link to the password reset page. The password reset link is unique to each account and expires if not used within a specified amount of time (currently 24 hours)

(learn more about [password modification](#password-modification-link))

#### User authentication
Users can login to the web app using their authentication credentials.  Once logged in, the web app maintains a session for the user to ensure each subsequent request can take advantage of any stored data (e.g. user roles, user ids, etc) about the user in order to present a personalized experience.

Users can logout in order to terminate the current session.

(learn more about [user authentication](#user-authentication-link))

#### Account cancellation
Users can cancel their accounts in order to terminate their relationship with the web app.

(learn more about [account cancellation](#account-cancellation-link))

#### Access Control
Administrators can set finely grained access control settings to determine what functionality is available to users.  Access control is maintained on a role basis whereby only users assigned to certain roles are allowed to perform certain actions.  Users can belong to one or more roles, some of which are assigned automatically (e.g. authenticated users) and others which may be assigned by the administrator.

(learn more about [access control](#access-control-link))

---

### Content management

#### Content creation
Users can create content to be stored in the web app.  Content created is automatically assigned a URL (if none is specified) and inherits any access control restrictions set by the administrator.  Each content created also stores associated meta-data (e.g. creator, date created/modified, rating, etc).  

Handyjs ships with two pre-defined content-types; Stories and Comments.  Stories are simple content types with just a title and body.  Comments also have a title and body but have the special property of being able to be associated with other content i.e. a Story can have multiple Comments associated with it.  Essentially, with these two content types, it is possible to create a simple blogging platform with Handyjs right out of the box.

#### Content editing
Users can edit content in the web app.  Any attributes of the content can be modified (e.g. titles, text, publish status, etc).  Whenever, content is modified, the relevant meta-data (e.g. last modified date) is also updated

#### Content deletion
Users can delete content in the wb app.  Any deleted content will no longer be available to users without special permissions to access.

#### Content publishing
Content is not generally available for access to users unless it is published.  This enables users to create "draft" content that is only visible to the creator.  Once published, the content becomes immediately available to all users with the appropriate permissions.

#### URL management
All content is accessible via a url.  Users can assign a url when creating or editing content.  If no url is assigned manually, a url is generated automatically.  Handyjs ensures each url is unique to each content.  Also, each content has a permalink; a url that can never change.  This means links targeting the content permalink will never break even if the url for the content is modified.

(learn more about [content management](#content-management-link))

---

### System management

#### System configuration
Site administrators can modify the behaviour of web apps using a form based interface to set configuration options.  These options range from setting custom error pages (404 & 501 pages), deciding who can register and create new accounts, setting the frequency of site backups and log reports, etc.  

#### Email
Handyjs web apps can send email using a dedicated email server or a transactional email service (Mandrill is the currently implemented option).  To send email using an email server, simply update the settings for the email server (address, port, user, password) or to use Mandrill, simply provide the Mandril API key.

#### Cron
Functions can ben executed periodically by adding them to the list of cron tasks.  Handyjs monitors when last the function was executed and ensures cron tasks are performed on schedule.

#### Sitemaps
All content created in Handyjs is automatically added to an XML sitemap.  Sitemaps are submitted periodically to the major search engines (Google and Bing are currently implemented)

#### Analytics
Analytics tracking is enabled simply by providing the tracking code from the analytics service (Google Analytics is currently implemented) to the site configuration.

#### Logging
Site activity can be logged via the Handyjs API.  Periodic log reports can also be generated and sent by email. 

#### Backups
Handyjs can create periodic database backups which can be saved to the server or delivered by email.

---

## Dependencies <a name='dependencies'></a>
* Nodejs 0.10.25
* Redis 2.8
* MySQL 5.6

---

## Getting started <a name='getting-started'></a>

### Directory structure
Download lastest version of Handyjs ([link to GitHub repository](http://www.github.com/handyjs)) and place in your project.  The typical file structure for a project built on Handyjs is as follows

**Directory structure**
````
project folder
  |
  -- handy (handy files)
  |
  -- lib (project files)
  |
  -- node_modules (module dependencies installed with npm)
  |
  -- routes (routing files)
  |
  -- views (views files)
  |
  -- tests (test files)
  |
  -- docs (documentation)
  |
  -- app.js (initialization setup file) 

```
**app.js**
```javascript
// require dependencies
var express = require('express')
  , path = require('path')
  , http = require('http')
  , favicon = require('serve-favicon')
  , handywrapper = require('./handy/lib/handy')
  , handy = handywrapper.get('handy')
  , project = require('./lib/project') 
  ;

var app = express();

// set public directory
app.use(express.static(path.join(__dirname, 'public')));

// set up favicon
app.use(favicon(path.join(__dirname, 'public/img/favicon.ico')));

// mount handy as a sub app
app.use(handywrapper);

// set project specific express configuration
var defaultPort = 2000;
// set environment variable PORT appropriately for sites hosted on the same server
app.set('port', process.env.PORT || defaultPort);

/* 
 * set routes
 * NOTE: Handy already reserves some routes for use (e.g. '/logout', '/login' etc.  See documentation for full list)
 * Handy routes take precedence over any new routes in the application
 */
var routes = require('./routes')(app);

// set views
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

/* handle 404 errors
 * NOTE: This should be the last app.use
 */
app.use(function(req, res, next){
  res.redirect('/notfound');
  return;
});


// Error Handler
app.use(function(err, req, res, next){
  switch (err.status){
    case 403:
      res.status(403);
      var pageInfo = {
        title: 'Access denied',
        config: handy.system.systemVariable.get('config'),
        user: req.session.user || {},
        siteinfo: {protocol: req.protocol, host: req.hostname, path: req.path, query: req.query, url: req.url},
        googleAnalyticsCode: handy.system.systemVariable.getConfig('googleAnalyticsId'),
        other: {}
      };

      /* NOTE: 403accessdenied is a view defined by the web app built on handyjs
       * and is not part of handyjs
       */
      res.render('403accessdenied', {pageInfo: pageInfo});
      return;
      break;
    case 500:
      res.status(500);
      var pageInfo = {
        title: 'Internal errors',
        config: handy.system.systemVariable.get('config'),
        user: req.session.user || {},
        siteinfo: {protocol: req.protocol, host: req.hostname, path: req.path, query: req.query, url: req.url},
        googleAnalyticsCode: handy.system.systemVariable.getConfig('googleAnalyticsId'),
        other: {}
      };

      /* NOTE: 500internalerror is a view defined by the web app built on handyjs
       * and is not part of handyjs
       */
      res.render('500internalerror', {pageInfo: pageInfo});
      return;
      break;
    default:
      res.status(500);
      var pageInfo = {
        title: 'Internal errors',
        config: handy.system.systemVariable.get('config'),
        user: req.session.user || {},
        siteinfo: {protocol: req.protocol, host: req.hostname, path: req.path, query: req.query, url: req.url},
        googleAnalyticsCode: handy.system.systemVariable.getConfig('googleAnalyticsId'),
        other: {}
      };

      /* NOTE: 500internalerror is a view defined by the web app built on handyjs
       * and is not part of handyjs
       */
      res.render('500internalerror', {pageInfo: pageInfo});
      return;
  }
});

/* set initial function to run after Handy initialization is complete
 * NOTE: In this scenario, project.start is the initializing function for the
 * web app built on handyjs
 */
handy.system.systemVariable.set('initialFunction', project.start);

// initialize handyjs and start project execution
handy.bootstrap.initialize(function(err){
  if(err){
    console.log('operating in ' + process.env.NODE_ENV + ' mode.\ninitialization completed with errors: \n', err, '\ninstallation required...');
    return;
  } else {
    console.log('operating in ' + process.env.NODE_ENV + ' mode.\ninitialization complete...');
    
    var initialFunction = handy.system.systemVariable.get('initialFunction') || function(){};
    initialFunction();  // start project execution
    return; 
  }
});

// start server
http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

```
---

### Theming
Because Handyjs manages some routes for projects (e.g. login, site configuration, etc) it may be useful to modify the default theming to match the rest of the project.  Handyjs theming is based on the [Bootstrap design framework](http://getbootstrap.com).  Handyjs views are mainly defined by three files

* layout.jade (/handy/views/layout.jade)
* header.jade (/handy/views/includes/blocks/header.jade) 
* footer.html ('/handy/views/includes/blocks/footer.html')

Modify the base views files as needed to match the rest of your site theming

---

### MySQL database setup
Set up a MySQl database and user by running the following commands

```mysql
CREATE DATABASE <databasename>;
CREATE USER '<user>'@localhost IDENTIFIED BY '<password>';
GRANT ALL PRIVILEGES on <databasename>.* TO '<user>'@localhost;
FLUSH PRIVILEGES;
```

---

### Redis database setup
Ensure Redis is running

---

### Installation
Start the app

```
node app.js
```

Pointing the browser to the main page "127.0.0.1:2000" will redirect to the installation page (if not, go directly to "127:0.0.1:2000/install").  Provide the basic site information (site name, email address, database credentials) and the credentials for the site administrator.  Submitting the form runs the automatic installation script to prepare the MySQL and Redis databases and set up the site.

After installation is complete, the site administrator can set various site configuration options.

---

### Routes
Handyjs controls the following routes.  Overriding these routes in your app may result in unpredictable behaviour (in short, do not override unless you really know what you are doing as some of the behaviour is subtle)

#### '/install'
The installation wizard.  It only needs to be run once; when the web app is started for the first time

#### '/welcomepage'
This is the default page authenticated users will see right after logging in.  A custom 'welcomepage' page can be specified in the site settings

#### '/configuration'
This is where most of the site configuration settings can be accessed.

#### '/configuration/permisssions'
This page provides a graphical UI to assign permissions and maintain the access control system

#### '/accessdenied'
This is the default 403 page.  A custom 403 error page can be specified in the site settings

#### '/notfound'
This is the default 404 page.  Acustom 404 error page can be specified in the site settings

#### '/cron'
This is the path to activate cron.  Each site has a random cron path (e.g. /cron/random_string) to provide some security against DOS attack via cron

#### '/sitemap.xml'
This is the XML sitemap

#### '/contact'
The site contact form

#### '/login'
User login page.  Users can login, register or request a password reset on this page

#### '/logout'
User logout

#### '/user'
Displays various views related to the user

If a user id is provided (e.g. '/user/9'), it displays the profile of the specified user.  If no parameters are provided, it displays the profile of the current user

'/user/:id/password/:action' - displays a password change or reset form (depending on the specified 'action').  Password changes require the user to provide the current password whilst password resets only require the new password.  Password resets are used in the scenario where the user has forgotten their password.

'/user/:id/account/cancel' - displays a page for the user to cancel their account.

#### '/content/create/:type'
Displays a form for creating content.  For use only with content that ships with Handyjs (i.e. Story, Comment, Category).

#### '/story/:id'
Displays Story content specified by 'id' ('id' can be the permalink URI or the URL alias of the specified content)

'/story/:id/edit' - displays a form to edit the Story content

'/story/:id/delete' - displays a form to delete the Story content

#### '/comment/:id'
Displays Comment content specified by 'id' ('id' can be the permalink URI or the URL alias of the specified content)

'/comment/:id/edit' - displays a form to edit the Comment content

'/comment/:id/delete' - displays a form to delete the Comment content

#### '/category/:id'
Displays Category content specified by 'id' ('id' can be the permalink URI or the URL alias of the specified content)

'/category/:id/edit' - displays a form to edit the Category content

'/category/:id/delete' - displays a form to delete the Category content

#### '/verifyemail/<random_string>'
This path is used to verify user's email addresses.  When it is required to verify the user's email address (e.g. after a user registers a new account), an email is sent to the email address with a link to this page.  The link will include a random string which is checked against a record in the user account.

#### '/requestonetimelink/<random_string>'
This path is used to request special one-time links to be sent to user's email addresses (e.g. user requests a password reset email, waits until the password reset link has expired, when they try to use it, they get a message letting them know they will need to request a new password reset link by visiting this page)

#### '/onetimelogin'
This page provides a password reset screen to users who have utilized a forgotten password link.  It allows them to set a new password before continuing on to the rest of the site.

---

## API Docs <a name='api-docs'></a>

### System

#### SystemVariable
systemVariable is the global variable used to pass data across modules in handyjs.  systemVariable has the following methods

##### Get
Read a property of systemVariable

**arguments**
* @param {string} key - property to be read

**example**
```javascript
var installation_flag = handy.system.systemVariable.get('installation_flag');
```

##### Set
Set the value of a property of systemVariable

**arguments**
* @param {string} key - property to be set
* @param {various} value - value to set

**example**
```javascript
var key = 'installation_flag';
var value = true;
handy.system.systemVariable.set(key, value);
``` 

##### updateConfig
Set configuration values.  Configuration values are special in that they are stored in the database and are restored everytime the app starts.  There are also a number of default configuration values that are provided.

**arguments**
* @param {object} update - key value pairs for configuration items to be updated

**example**
```javascript
var update = {siteName: 'my first handyjs webapp'};
handy.system.systemVariable.updateConfig(update, callback);
```

##### getConfig
Get the value of a configuration property

**arguments**
* @param {string} key - name of configuration parameter to read

**example**
```javascript
var key = 'siteName';
var siteName = handy.system.systemVariable.getConfig(key);
```

#### BaseObject
Handyjs has a default object that other object types (e.g. content and user objects) build upon.  This means object types built upon the base object inherit the methods and properties of the base object.

The properties of the base object are
* id: integer identification for each object (unique for each object type)
* createdate: time stamp indicating when the object was created
* modifydate: time stamp indicating last time the object was modified 
* deleted: indication of whether the object has been deleted ("true" means the object has been deleted)

BaseObjects have the following methods

##### Get
Read the value of a property of the object.  Returns null if attribute does not exist

**arguments**
* @param {string} key - property to be read

**example**
```javascript
var newObject = new handy.system.BaseObject();
// do a bunch of stuff with newObject
var key = 'createdate';
var createDate = newObject.get('createdate');  
```

#### Set
Set the value of a property of the object

**arguments**
 * @param {string} key - the object property to be set
 * @param {all datatypes} value - the value to which the property is to be set

**example**
```javascript
var key = 'deleted';
newObject.set(key, true);
```
#### createTable
Create database tables to store object records.  This API function is only called during the bootstrap process and should NEVER be used under normal circumstances.  It is included in the documentation only for completeness

**arguments**
None

**example**
```javascript
newObject.createTable(callback);
```

#### Load
Load object into memory from database

**arguments**
 * @param {integer/string} id - unique identifier of the object being loaded
 * @param {string} type - type of identifier

**example**
```javascript
var id = 55;
var type = 'id';
newObject.load(id, type, callback);
```

#### Save
Save object to database

**arguments**
none

**example**
```javascript
newObject.save(callback);
```

#### cloneObject
Update all the properties of the object with those from the source
also performs some transformations e.g. transforms datetime strings into date objects

NOTE: This function bypasses the validation checks built into BaseObject.set so it is possible to have an object with the wrong value types (as compared to the schema definition)

**arguments**
 * @param {object} sourceObject - source object which provides all the properties

**example**
```javascript
var sourceObject = {
  id: 6,
  createdate: "Tue Aug 19 2014 02:56:35 GMT-0400 (EDT)",
  modifydate: "Tue Aug 19 2014 02:56:35 GMT-0400 (EDT)",
  deleted: false
}

var newObject = new handy.syste.BaseObject();
newObject.cloneObject(sourceObject);
```

#### systemMessage
Set and retrieve system messages

System messages are used to inform the user of the state of the system (usually to indicate the result of some action taken)

**arguments**
 * @param {object} req - express request object
 * @param {string} msgType - types of system messages e.g. 'success', 'warning' and 'dev'
 * @param {string} msg - message for display
 * @param {bool} clearFlag - flag to delete messages after reading. Set to 'true' to delete messages (default)

**example**
```javascript
var msgType = 'warning';
var msg = 'Your password needs to be changed';
system.systemMessage.set(req, msgType, msg);  // displays message to user asking them to change their password
```

#### restoreSystemMessage
Restore system messages before a redirect.  This function is needed to resolve an edge case where system messages are set and then a redirect is issued.  Invoking res.redirect wipes out the previous res object.  This is a problem if the system messages have been transferred from req.session.msgCache to res.locals.sysmessage (as occurs after prepGetRequest has been called).  restoreSystemMessage moves the system messages safely back to req.session.msgCache.

NOTE: Invoke this function before res.redirect if another function (such as prepGetRequest) has moved system messages from req.session.msgCache to res.locals.sysmessage

**arguments**
 * @param {object} req - expresss request object
 * @param {object} res - express response object

**example**
```javascript
system.prepGetRequest(options, req, res, function(err, pageInfo){
  system.restoreSystemMessage(req, res);  // ensure system message are restored prior to redirecting
  res.redirect('/new/destination');
});
```

#### sendEmail
Send email to receipient.

NOTE: if NODE_ENV !== 'production', emails will not be sent.  This is done so development or staging environments can test against live data safely.

Ensure all email related configuration settings are properly set otherwise this API call will fail

**arguments**
 * @param {object} receipient - email receipient (format: {name: <receipient name>, email: <receipient email>})
 * @param {object} sender - email sender's address (format: {name: <sender name>, email: <sender email>})
 * @param {string} subject - email subject
 * @param {object} body - email body as text and html. (format {text: <body as text>, html: <body as html>})
 * @param {string} cc (optional) - email cc's address (format address or name <address> or "name <address>")
 * @param {array} attachment (optional) - array of attachments to email.  format of each attachment {path: <path>, name: <name of file>, data: <base64 data stream>, type: <file type>}
 * @param {string} replyAddress (optional) - reply to address for the email

**example**
```javascript
var receipient = {name: 'john', email: 'john@eample.com'};
var sender = {name: 'jill', email: 'jill@example.com'};
var subject = 'want to hike to the top of the hill?';
var body = {
  text: 'John\n, want to go hiking on the weekend?\n\nJill',
  html: '<html header-stuff><html><head></head><body><strong>John</strong><br/>want to go hiking on the weekend?<br/><br/>Jill</body></html>'
};
var attachment = {
  name: 'map_of_hill',
  path: '/path/to/image',
  type: 'image/jpeg'
};

system.sendEmail(receipient, sender, subject, body, null, attachment, null, function(err){
  // email sent
});

```

#### tokenReplace
Replace tokens in strings

**arguments**
 * @param {string} message - message on which to perform token replacement
 * @param {object} req - current request object
 * @param {object} currentUser - (optional) basis for token replacements regarding current user. If user argument is not provided, the current session user is assumed to be the current user

**example**
```javascript
var messageTemplate = '[site:name] message.  Hi [user:name], hope you are having a good day';
var message = system.TokenReplace(messageTemplate, req);
console.log(message);  // 'Handyjs.org message.  Hi Bob, hope you are having a good day'
```

#### recordUrlHistory
Keep a record of the user's url history (middleware). This is used to perform url redirects to any previous locations to use this as a regular function (as opposed to as middleware) just pass in a fourth parameter, regularFunctionFlag, which can be anything

**arguments**
 * @param {anything} regularFunctionFlag - indicates the function is not running as middleware

**example**
```javascript
app.get('/a/path', system.recordUrlHistory, function(req, res){
  
});
```

#### redirectBack
Redirect user to a url in their previous history

**arguments**
 * @param {number} steps - number of steps to go back in history (0 means current page)
 * @param {object} req - current request object
 * @param {object} res - current response object

**example**
```javascript
  system.redirectBack(1, req, res);  // returns the user one page back in their history
```

#### recordUrlAlias
Create and record URL aliases

Each content object can be accessed by two urls.  One Url is a perma-link (it never changes) and the other is an alias (which can be changed or modified).  This API call ensures the chosen Url alias is unique (to prevent inadvertent collisions).

This API is called automatically whenever any content object is saved.  Normally, it should not be necessary to access this API directly.  It is only included in the documentation for completeness.

**arguments**
 * @param {array} resource - the array of resources for which the URL alias is being created.  Each element can be a Content object or any other object with the following parameters - url: proposed url alias.  

 This may be modified to ensure uniqueness.  For Content objects, the format should be 'contenttype/alias' where alias must be a string and not a number

**example**
```javascript
var newContent = new content.Story();  // create a new story instance
newContent.url = '/my/hopefully/unique/url';

system.recordUrlAlias([newContent], function(err){
  
});
```

#### getContentFromAlias
Get the content url and id associated with an alias.

This API is used in retrieving the appropriate content for routes accessed via the content alias.

For example, GET 'story/jack-and-jill' -> GET '/story/15'

**arguments**
 * @param {string} alias - alias to be translated into the associated content id and url

**example**
```javascript
app.get('/content/:alias', function(req, res){
  var contentDetails = system.getContentFromAlias(req.params.alias); // {id: 6, url: '/content/jack-and-jill'}
});
```

#### runCron
Execute cron tasks

**arguments**
 * @param {obj} req - express request object
 * @param {obj} res - express response object

**example**
```javascript
system.runCron(req, res, callback);
```


#### addCronTask
Add tasks to cron

NOTE: task names are unique.  To prevent accidentally clobbering an existing task, prefix cron task names with the name of your app module e.g. 'mycoolapp send email newsletter'.

Cron is maintained in two separate places in systemVariable; cronTask and config.cronRecord.  

cronTask is formatted as {'task name': task function}.  This information is not persisted in the database and is reset each time the application is restarted

cronRecord is formatted as {task name: {freq: frequency, lastrun: time last run}}.  This information is stored in the database and is retrieved each time the app is started

Obviously cronTask and cronRecord must be kept in sync.  This is done by functions addCronTask and deleteCronTask

**arguments** 
 * @param {string} taskName - unique name to identify task. use human recognizable name e.g. 'nightly backup'
 * @param {function} task - task to be run.
   *     - pass as 'null' if just updating the frequency
   *     - task will be run as task.bind(null, req, res)(callback)
   *     - task needs to return callback(null, {err: <any error>, key1: <string>, key2: <string>})
   *     - err should contain error objects
   *     - if no err, then there must be at least one key/value pair returned e.g. {'newsletter': 'sent succesfully'}
* @param {string / integer} freq - frequency at which the task needs to be run.  specified in minutes (also accepts
   'hourly', 'daily', 'weekly')

**example**
```javascript
function longRunningProcess(callback){
  // do stuff
  return callback(null, {err: errorValue, result: resultValue});
}

/* this needs to run each time the app starts or restarts
    usually a good idea to run this right after bootstrap.initialize
*/
system.addCronTask('myapp_cronLongRunningProcess', longRunningProcess, 'daily', callback);

```

#### deleteCronTask
Remove cron task

**arguments**
 * @param {string} taskName - name of cron task to be removed

**example**
```javascript
var removeFunction = 'myapp_cronLongRunningProcess';
system.removeCronTask(removeFunction, callback); // myapp_cronLongRunningProcess will no longer be executed on cron 
```

#### backupDatabase
Backup database.  The backup is either sent to an email address or stored in a directory on the server, depending on the system settings

**arguments**
 * @param {object} req - express request object
 * @param {object} res - express response object

**example**
```javascript
system.backupDatabase(req, res, callback);
```

#### prepGetRequest
Prepare pageInfo object (pageInfo object contains rendering information for the page being prepared for display) for use in GET responses and performs a bunch of useful tasks common to all GETs

NOTE: Because this function moves the system messages from req.session.msgCache to res.locals.sysmessage, if there is a need to redirect afterwards, system messages NEED to be moved back to req.session.msgCache otherwise they will be lost as res.redirect creates a new res object.  Use restoreSystemMessage to preserve the system messages in this situation.

**arguments**
 * @param {object} option - custom information for this particular request.  is in the form {info:<info_option>, action:<action_option>}
 * @param {object} req - express request object
 * @param {object} res - express response object

**example**
```javascript
var pageTitle = 'Help page';
var options = {
  info: {
    title: 'Help page',  // sets the page title
    action: []  // can include any functions to automatically run
  }
};
system.prepGetRequest(options, req, res, callback);
```

#### logger
Define system logging.  Records system logs and generates reports

**arguments**
 * @params {string} level - type of log level ('info', 'warn', 'error')
  *   info - regular site operations e.g. GET requests successfully satisfied
  *   warn - irregular activity e.g. 404 error, login failure
  *   error - system error e.g. database read error, 
 * @params {object} record - log object
  *   format: logObject = {req: <express req object>, category: <log category e.g. "user" or "cron">, message: <descriptive message>), 
  *           if logging an error, format is logObject = {error: <error object>, message: <description>}
 * @params {string/int} period (optional) - period for which the log report will cover 
  *   format: (integer representing age in hours or string options 'hourly', 'daily', 'weekly', 'monthly')
  *           if ommitted, period will use the systemvariable value of 'reportFreq'

**example**
```javascript

// record log event
var level = 'info';
var record = {
  req: req,
  message: 'user login successful',
  category: 'user',
  time: 'Tue Aug 26 2014 16:32:49 GMT-0700 (PDT)'
}

logger.record(level, record);

// generate log report
var period = 'daily';  // generate report for the previous 24 hours
logger.report(req, res, period, callback);  // log report is generated and sent to the destination assigned in the system settings

```

#### validateForm
Form validation.  This API makes various back-end checks on Handyjs forms to ensure the user input provided is suitable (e.g. required fields are provided, password confirmation fields match password field, emails are properly formatted, maximum string lengths are enforced, etc).

The function can be extended to provide custom validations

**argumuments**
 * @param {string} formType - type of form being validated e.g. userLogin, passReset, etc.  
  * Can also be a callback function to execute custom validation
 * @param {req} Express request object
 * @param {res} Express response object
 * @param {next} Express next object

**example**
```javascript
 
app.post('/form/action', system.validateForm('userRegister'), function(req, res){
  
});

// to perform a custom validation
function customValidation(req, res){
  // validation stuff
}

app.post('/form/action', system.validateForm(customValidation), function(Req, res){
  
});
```
---

### User
All User API calls are prefixed by handy.user i.e. to access user API "doStuff", call handy.user.doStuff

#### User
Creates a new User object
```javascript
var newUser = new handy.user.User();
``` 
User objects have the following properties, in addition to the default system properties 
* name: User name
* email: user email address
* passwordhash: hash of user password
* salt: salt used to generate password hash
* lastlogin: time record of the last user login
* authenticated: indication that user is properly authenticated at this time
* verified: indication that user account has been verified e.g. user has confirmed their email address
* creator: user that registered this user account
* onetimelink: secret string used to verify user account for password resets or email address verifications
* onetimelinktimestamp: time record of generation of one time link.  Used to check if one-time links have expired
* role: array of roles this user is assigned to

User objects have the following methods

##### User.load
Retrieves user record from database
 
**rguments**
 * @param {int/string} id - unique identifier of the user record
 * @param {string} type - type of identifier i.e 'email' or 'id'

**example**
```javascript
newUser.load('john@doe.com', 'email', function(err){
  console.log(newUser);  // will display all the properties of the user record retrieved from the database
});

```

##### User.hash
Generate password hash (with optional salt, if salt is not provided, one is created automatically)
 
 **arguments**
 * @param {string} pwd - password to be hashed

**example**
```javascript
newUser.salt = 'cryptographically_random_salt';  // optional
newUser.hash('mysecurepassword', function(err){
  console.log(newUser.passwordhash);  // displays the created password hash
});
```

##### User.authenticate
Authenticates user based on email and password combination

NOTE: authentication does not create a session for the user.  It only
checks the validity of the email/password combination. If you
want to create a user session, use function 'login' (after authentication
of course)

**arguments**
 * @param {string} email - user email
 * @param {string} password - user provided unhashed password

**example**
```javascript
var email = emailFromUserLoginForm;
var password = passwordFromUserLoginForm;

newUser.authenticate(email, password, function(err){
  // if email and password combination are correct
  console.log(newUser.authenticated); // displays "true"

  // if email and password combination are incorrect
  console.log(newUser.authenticated); // displays "true"
});

```

##### User.login
Login user and create a session for this user.
NOTE: Ensure the user is authenticated (i.e. by running User.authenticate) first before creating a login session

**arguments***
 * @param {object} req - express request object

**example**
```javascript
newUser.login(req, function(err){
  console.log(newUser.role);  // displays ['authenticated']
  console.log(req.session.user); // displays newUser object
});
```
##### User.logout
Logout user and destroy session

**arguments**
 * @param {object} req - express request object

**example**
newUSer.logout(req, function(err){
  // newUser.role will not contain ['authenticated']
  console.log(req.session.user); // displays "undefined"
});

##### User.createOneTimeLink
Create one time link used for email verification or password rest

**arguments**
 * @param {string} type - type of one time link, options are 'email', 'password'.
 option email generates one-time links that can only be used for email verification
 option password generates one-time links that can only be used for password modification e.g forgot password
 A one-time link generated for email verification cannot be used for password reset (and vice-versa)

**example**
```javascript
newUser.createOneTimeLink('email', function(err){
  console.log(newUser.onetimelink);  // displays cryptographically random string
  console.log(newUser.onetimelinktimestamp);  // displays time record of creating one-time link
});
```

##### User.verifyOneTimeLink
Verifies one-time link supplied by the user (usually as part of a link sent to the user by email) is correct and has not expired. 
If verification is successful, the one-time link is nulled out (to ensure it can only be used once)
NOTE: the verification of the one-time link is a comparison of hashes and not a straight string comparison i.e. a hash of the provided
one-time link is compared to the stored one-time link for the user 

**arguments**
 * @param {string} type - type of one-time link.  options are 'email' (for email verification) or password (for password resets)
 * @param {string} link - user supplied link to be tested
 * @param {int} daysToExpiry - (optional) length of time in days for the link to be considered expired.  0 means never expires 

**returns**
Returns a verification flag (and the user object details if the verification is successful)
Return values are 'user not found', 'no previous request', 'link expired', 'match failed' & 'success'

**example**
```javascript
var type = 'email';
var oneTimeLink = 'string_extracted_from_link';
var daysToExpiry = 0;  // email verification links never expire but it is usually a good idea to expire password reset links after 24 hours
newUser.email = 'john@doe.com';  // extracted from one time link
newUser.verifyOneTimeLink(type, oneTimeLink, function(err, verifyFlag){
  // possible values of verifyFlag
  console.log(verifyFlag); // displays 'user not found' if user record could not be located
  console.log(verifyFlag); // displays 'no previous request' if user did not previously request an email verification or password reset link
  console.log(verifyFlag); // displays 'link expired' if one time link has passed expiration data
  console.log(verifyFlag); // displays 'match failed' if user provided one-time link does not match the on-time link on record
  console.log(verifyFlag); // displays 'success' if one-time link successfuly verified

  // in the event of an email verification and a successful one-time link verification
  console.log(verifyFlag); // displays "true"; 

});
```

##### User.register
Creates new user account.

Upon registration, a number of automatic processes are carried out
* Welcome emails are sent to the email address associated with the new user account (may include an email verification link)
* User record is recorded in the database

**arguments**
 * @param {object} req - express request object

**returns**
If registration is successful, returns calllback(null, 'loggedin') if new user is logged in, 
Returns callback(null, 'notloggedin') otherwise
All users are automatically assigned to "authenticated" role upon successful registration

**example**
```javascript
newUser.register(req, function(err, loginStatus){
  // if account registration is successful and was initiated by user e.g. user filled out a registration form on the app
  console.log(loginStatus);  // displays 'loggedin'
  console.log(newUser.authenticated)// displays "true"
  console.log(req.session.user);  // displays newUser object
  console.log(newUser.verified);  // displays "true" only if the "email verification not required" option is selected, otherwise newUser.verified is 'false' until the user verifies their email address

  // if account registration is successful but was not initiated by user e.g. account was created for the user by a site administrator
  console.log(loginStatus);  // displays 'notloggedin'

});
```

##### User.initiatePasswordReset
Initiate a password reset e.g. user has forgotten their password and needs a password reset link sent to them
Sends an email with a one-time link to the user email address.  Following the link, takes the user to a page where they can create a new password
 
**arguments**
 * @param {object} req - express request object

**example**
```javascript
newUser.initiatePasswordReset(req, function(err){
  
});
```

##### User.cancelAccount
Cancels a user account preventing them from interacting with the web app again.
if the 'notify user of account cancellation' option is selected, a cancellation notice is sent to the user email address

**arguments**
 * @param {object} req - express request object

**example**
```javascript
newUser.cancel(req, function(err){
  
});
```

##### User.changePassword
Changes the password on user account

Currently their are two scenarios
1. change - the user is aware of their current password but wants to change it
2. reset - the user is unaware of their current password and wants to choose another one (e.g. first time login after an account has been created for you or when you reset your password)

**arguments**
 * @param {string} type - type of password change scenario ("change" or "reset")
 * @param {string} oldPassword - (optional, not required for type "reset") current password
 * @param {string} newPassword - new password 
 * @param {object} req - express request object

**example**
```javascript
var type = 'change';
var oldPassword = 'my_old_password';
var newPassword = 'my_super_secret_password';

newUser.changePassword(type, oldPassword, newPassword, req, function(err, loggedinStatus){
  // if password change is successful, user is logged in
  // if user login is successful
  console.log(loggedinStatus);  // displays 'loggedin'

  // if user login is unsuccessful
  console.log(loggedinStatus);  // displays 'notloggedin'
});

```

##### User.assignRole
Assigns a role to the user
NOTE: All roles are lowercased by convention (i.e. "ABCD" === "abcd")
Also, the role will be automatically created if it does not already exist

**arguments**
 * @param {array} role - array of roles to which the user is being assigned

**example**
var role = ['editor', 'premium member'];
newUser.assignRole(role, function(err){
  console.log(newUser.role);  // displays ['editor', 'premium member']
});

##### User.unAssignRole
Unassign a role from a user
NOTE: All roles are lowercased by convention (i.e. "ABCD" === "abcd")

**arguments**
 * @param {array} role - roles from which the user is being unassigned

**example**
```javascript
var removeRole = ['premium member'];
console.log(newUser.role);  // displays ['editor', 'premium member']
newUser.unAssignRole(removeRole, function(err){
  console.log(newUser.role);  // displays ['editor']
});
```

#### requireAuthenticationStatus
Middleware to check authentication status of current user session

**arguments**
 * @param {string} status - authentication status to verify (options 'authenticated' or 'unauthenticated')

**example**
```javascript
app.get('/some/path/only/available/to/authenticated/users', handy.user.requireAuthenticationStatus('authenticated'), function(req, res){
  req.send('this should only be displayed to authenticated users.  unauthenticated users should get a 403 error')
});
```

#### approveAccountRegistrationRequest
Enables administrators or appropriately permission users to approve user registration requests (for the case where the "who can register accounts" option is set to "users, but with administrator approval")
This function sets the account verified flag to true for each user registration request approved, meaning the user will not be required to verify their email addresses.
Notification emails will be sent to each approved user account.

**arguments**
 * @param {array} uidList - list of ids for users pending registration to be approved
 * @param {object} req - express request object

**example**
```javascript
var uidList = [6, 9, 24];  // list of user ids for accounts to be approved
handy.user.approveAccountRegistrationRequest(uidList, req, function(err){
  
});
```

#### checkPermission
Check the user has the appropriate permissions to perform a task
NOTE: This function works as both middleware or as a straight function.

To access the straight functionality, include a callback function which will be returned as callback(err, status) with 'status' indicating whether permission was granted or not

**arguments**
 * @param {int} userId - user id for user whose permissions are being checked - optional
 * @param {string} resource - resource being checked for permission to access
 * @param {array} task - array of tasks being checked for permission to perform.  tasks are OR'ed (i.e. return true if permission exists for just one of the tasks)
 * @param {object} req - express request object
 * @param {object} res - express response object

**example**
```javascript
// middleware example
app.get('/path/only/accessible/to/users/with/admin/roles', handy.user.checkPermission('system.System', ['can modify site configuration']), function(req, res){
  res.send('only users with the appropriate roles will see this message.  all others will get a 403 error')
})

// straight function example
var uid = 56;  // id of user whose permissions are being checked
var resource = 'system.System';
var task = ['can modify site configuration'];
handy.user.checkPermission(uid, resource, task, function(err, flag){
  console.log(flag); // displays "true" if user has the appropriate permissions, otherwise "false"
})(req, res);
```
#### checkUserHasSpecificContentPermission
Check if user has the permission to modify/delete this specific content i.e. they have permission to modify/delete all content or in the case where this content belongs to them, they have permission to modify/delete their own content
 
 **arguments**
 * @param {object} req - express request object
 * @param {object} res - express response object
 * @param {integer} uid - user id
 * @param {string} contentType - content type
 * @param {integer} urlId - content id
 * @param {string} actionType - type of action being performed i.e. 'edit' or 'delete'

**example**
```javascript
var uid = 56; // id of the user whose permissions are being checked
var contentType = 'story';  // type of content
var urlId = 25; // id of content
var actionType = 'delete';  // action being performed on the content

handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, actionType, function(err, flag){
  console.log(flag); // displays "true" if user has the appropriate permissions, otherwise "false"
});
```

#### updateRolePermission
Update resource permissions for roles
NOTE: Updates replace any previous permission settings for each role / resource e.g. if role "A" has permission "b" on resource "c", updating permission "d" on the same role / resource relationship will result in permission "b" being removed.  In order, to add permissions, both current and new permissions must be provided.

**arguments**
 * @param {array} roleResourcePermissionList - array of role resource permission objects used to perform update format [{role: myrole, resource: myresource, permissions: [list of permissions]}, {...}, {...}]

**example**
```javascript
var roleResourcePermissionList = [
  {role: 'premium user',
   resource: 'content.Podcast',
   permissions: ['can submit new podcast', 'can access podcasts']
  }
];
handy.user.updateRolePermission(roleResourcePermissionList, function(err, roleResourcePermissionList, rolesPermissionGrant){
  console.log(rolesPermissionGrant); // displays rolesPermissionGrant object which contains all the permission grants for each role in the system
});
```

#### createRole
Create a new role which may be assigned to users

**arguments**
 * @param {string} newRole - new role to be created (will be lowercased)

**example**
```javascript
var newRole = 'super users';
handy.user.createRole(newRole, function(err){
  
});
```

#### deleteRole
Delete a role so it can no longer be assigned to users

**arguments**
 * @param {string} role - name of role to be deleted

**example**
```javascript
var role = 'super users';
handy.user.deleteRole(role, function(err){
  
});
```

#### aclReset
Reset access control system
Access control settings are maintained in the Redis database, however, it is possible for the Redis db to become corrupted or deleted.  In the case of such an event, this function will restore the access control settings.

**arguments**
none

**example**
```javascript
aclReset(function(err){
  
});
```

#### initializePermissionGrants
Initialize permission grants to various roles and updates the Redis database.
Basically, it takes the list of resources and associated permissions and grants all to the administrator role then, it goes through each other role and grants them requested permissions.  

Also, all roles, resources and tasks are lowercased (i.e. 'ABCD' === 'abdc')

NOTE: Under normal circumstances, there should NEVER be a need to use this API function as it is only required during the bootstrap process.  It is included in documentation only in the interest of completeness

**arguments**
none

**example**
```javascript
handy.user.initializePermissionGrants(function(err){
  
});
```

#### postUserVerificationProcessing
Post user verification processing performs a number of tasks whenever a user account has been verified e.g. any content created by an unverified user is automatically set to "unpublished" (i.e. it is not visible on the site) but once the user becomes verified, all their draft content gets published.
This function should be called each time a user account is verified
 
 **arguments**
 * @param {array} uidList - array of ids of users that have been verified

**example**
```javascript
var uidList = [45, 78, 89];  // list of ids for user accounts which have just been verified
handy.user.postUserVerificationProcessing(uidList, function(err){
  
});
```
---

### Content
All Content API calls are prefixed by handy.content i.e. to access content API "doStuff", call handy.content.doStuff

#### createNewContentType
Create new content types
This function allows the programatiic expansion of content types i.e. new content types can be defined at run time and they will inherit all the methods and properties of the existing Content object.  This ensures content types in future projects do not break when the Content object is upgraded
 
 **arguments**
 * @param {array} contentTypes - Collection of content types to be created.  
    Format [{name: contentType name, definition: additional methods and properties of content type}]
    format of definition
      {
        init: <additional properties for the new content type>
        schema: <additional database schema definitions for the new content type>
       }

**example**
```javascript
var bugReport = {
  name: 'bugReport',
  definition: {
    init: {
      contenttype: 'bugreport',
      'status': 'unresolved'
    },
    schema: {
      tablename: 'bugreport',
      columns: {
        status: {type: 'VARCHAR', size: 100, null: false, default: 'unresolved'}
      }
    }
  } 
}
var contentType = [bugReport];

handy.content.createNewContentType(contentType, function(err){
  
});
``` 
Content objects have the following default properties, in addition to the default system properties (other properties can be added by specifying as part of "definition.init")
* title: title of content
* body: body text for content
* published: true / false indication whether the content is in draft mode (i.e. not published) or visible to on the site
* rating: rating of content on a 0 - 10 scale
* contenttype: type of content.  this property is unchangeable and is set whenever a new instance is created
* url: path to access the content on the web app
* creator: id of user that created the content
* category: id of category this content is assigned
* contentlist: id of shared contentlist.  all content has an assigned contentlist id.  if two content objects have the same contentlist id, it means they are related e.g. a blog post and a comment may both share the same contentlist id meaning the comment is attached to that blog post

Content objects have the following methods (other methods can be added by specifying as part of "definition.init")

New instances of content can be created using the createNewInstance API (see documentation for full details)
```javascript
var newContent = handy.content.createNewInstance('bugReport')
```

##### Publish
Publish content

**arguments**
none

**example**
```javascript
newContent.publish(function(err){
  console.log(newContent.published);  // displays "true"
});
```

##### Unpublish
Unpublish content and set to draft mode

**arguments**
none

**example**
```javascript
newContent.unpublish(function(err){
  console.log(newContent.published);  // displays "false"
})
```

##### Rate
Rate content

**arguments**
@params {int} rating - rating of content on a scale of 0 - 10

**example**
```javascript
newContent.rate(6, function(err){
  console.log(newContent.rating);  // displays "6"
});
```

##### Save
Save content to database

**arguments**
none

**example**
```javascript
newContent.save(callback);
```

##### Load
Load content from database.  If the content is in the cache, the cached object will be loaded instead

**arguments**
 * @param {integer} id - id of content being loaded
 * @param {string} type - type of identifier i.e. 'id'

**example**
```javascript
var id = 44;  // id of content to be loaded
var type = 'id';  // specifying that the unique identifier is an "id"
newContent.load(id, type, function(err){
  console.log(newContent);  // displays stored value of bugReport with id of 44
})
```
##### getRelatedContent
Get content that is related to this content instance e.g. get all the comments associated with a particular content

**arguments**
 * @param {string} type - type of related content to be returned

**returns**
returns an array of related content objects e.g.
```
[
{related content object #1}, {related content object #2}, {related content object #3}, ...
]
```
**example**
```javascript
var type = 'comments';  // return comments related to this content
newContent.getRelatedContent(type, function(err, results){
  console.log(results);  // displays array of related comments
});
```
#### createContent
Create new content.  This API is a wrapper function for the Content.save API.  It is used particularly to create content based on the result of a form submission.  It is required so that the form processing will not be too unweidly
 
 **arguments**
 * @param {string} type - type of content being created
 * @param {object} seed - parameters of the object to be created.  If the content type is not a standard Handy object, the key/values of seed will be transfered without any transformations

 **example**
 ```javascript
var type = "bugReport";
var seed = {
  published: true,
  status: 'resolved'
};
handy.content.createContent(type, seed, callback);
```

#### createNewInstance
Create new instance of a content type

**arguments**
 * @param {string} contentType - type of content for which a new instance is required

**example**
```javascript
var newContent = handy.content.createNewInstance('bugReport');
```

#### findContent
Find content based on search criteria

**arguments**
 * @param {string} type - content type
 * @param {object} criteria - search criteria required to match
 * @param {object} options - search options


**example*
```javascript
var type = 'bugReport';
var criteria = {
  status: 'open',
};
var options = {
  count: 10,
  offset: 0,
  commentCount: false
};  // return only ten results, starting from the most recent results and do not return the number of comments associated with each return content

handy.content.findContent(type, criteria, options, function(err, results){
  console.log(results);  // displays array of matching content objects
  /*
  results [
    {id: 4, published: true, status: 'open'}, {id: 77, published: false, status: 'open'}
  ]
  */
});
```

#### submitXMLSitemap
Submit sitemap to search engines (Google and Bing)

**arguments**
 * @param {object} req - express request object
 * @param {object} res - express response object

**returns**
This function is meant to be run as a cron task therefore the format of the callback is callback(null, err, result)

**example**
```javascript
handy.content.submitXMLSiteMap(req, res, callback)
```

#### getCategorySelectOptions
 Convenience function to prepare category options in format suitable for display.  Prepares the category hierarchy for display in format 
 garndparent -> parent -> child
 
 **arguments**
 * @param {object} defaultObj - default category; used to determine when 'selected' is true (optional)
 * @param {string} type - identifies which type of default match is required.  'self' matches default object, 'parent' matches object's parent (optional)

**returns**
returns categories in format
```
[
  {value: <val>, selected: true/false, text: 'grandparent -> parent -> child', name: <category name>}, {etc}
]
```

### Special Content Types

#### Categories
Categories are not strictly "content" types.  Category objects only inherit the default methods and properties of default system objects. Categories, however, have an additional property "parent".  The parent proprty of a category refers to the id of another category.

**example**
```
var animal = new handy.system.category();
console.log(animal.id);  // let's say the id for animal is 42
var dog = new handy.system.category();
var dog.parent = 42;  // set "dog" category as a child of the "animal" category
``` 

#### Story
Story is one of the two content types that ships with Handyjs.  It has only the default methods and properties of Content types

### Comment
Comment is one of the two content types that ships with Handyjs.  It has only the default methods and properties of Content types.

---

### Utility
All Utility API calls are prefixed by handy.utility i.e. to access utility API "doStuff", call handy.utility.doStuff

The Utility API consists of "helper" functionality for the other Handyjs modules.  Basically, if there is some functionality that is required repeatedly by other modules, it will live in the Utility module.

#### subClass
subClass is used to manage prototypical inheritance of objects.  Central to the architecture of Handyjs is a set of objects inheriting methods and properties from each other.  subClass converts an object into a Child class of another Parent object.

**Handyjs Object Inheritance Model**
```
BaseObject
  |
  -- User
  |
  -- Content
  |   |
  |   -- Story
  |  |
  |  -- Comment
  |
  -- Category

```
**arguments**
* @param {object} parent - parent class
* @param {object} child - child class

**example**
```javascript
function Child(){
  var param1 = {key: val};
  var param2 = {key: val};
  Parent.call(this, param1, param2); // set up object using the methods and properties of Parent
}

utility.subClass(Parent, Child);  // Child now inherits the methods and properties of Parent but has its own constructor
```

### populateNewObject
populateNewObject is used to populate attributes of new object instances by iterating over an initializing object which contains all the attributes i.e. send in an object like {key1: val1, key2: val2} and the created object instance will have this.key1 = val1 and this.key2 = val2

**arguments**
* @param {object} initObject - initializing object

**example**
```javascript
function emptyObject(initializer){
  utility.populateNewObject.call(this, initializer);  // set up the properties of this object based on the values in initializer
}
```

### removeLastCharacter
Remove last occurence of a character from a string.  Particularly useful to remove trailing comma from strings generated in loops e.g. "string1, string2, string3,"

**arguments**
* @param {string} char - character or string to be removed
* @param {string} string - string to be modified

**example**
```javascript
var modString = 'Andy + Bob + Candy + Dan +';
var finalString = utility.removeLastCharacter(' +', modString); // 'Andy + Bob + Candy + Dan'
```

### escapeRegExp
Escape string characters to be used as literal string within a regular expression

**arguments**
* @param {string} string - string to be escaped

**example**
```javascript
var message = '[user name] needs to do a bunch of stuff.  [user name] should do it now';
var re = new RegExp(utility.escapeRegExp('[user name]'), 'g');
var userName = 'Dan';
var newMessage = message.replace(re, userName);
```

### checkUniqueRecord
Check if a record in a database table is unique e.g. check to see if there is more than one user with the same email address 

**arguments**
 * @param {object} recordToTest - record being checked for uniqueness.  format {column: columnname, value: recordvalue}
 * @param {object} expectedRecord - (optional) an existing record in the database which can be ignored.  if null, it is assumed there should be no occurences of the record in the table
 * @param {string} table - table in which to search for uniqueness

**returns** 
format callback(err, uniqueFlag) where uniqueFlag is true if the recordToTest is unique and false otherwise

**example**
```javascript
var recordToTest = {
  column: 'email',
  value: 'bob@gmail.com'
};

// we expect to find a record for bob@gmail.com with an id of 6 so ignore this record if found
var expectedRecord = {
  column: 'id',
  value: 6
};

utility.checkUniqueRecord(recordToTest, expectedRecord, 'user', function(err, uniqueFlag){
  console.log(uniqueFlag);  // 'true' if there is no other record in 'user' table other than the expected one (false otherwise)
});
```

### isArrayEqual
Check if two arrays are equal to each other.

For some reason javascript does not return true for ['a'] === ['a'] so this function returns true if both arrays are the same, false otherwise

**arguments**
 * @param {array} array1 - first array to be used for comparison
 * @param {array} array2 - second array to be used for comparison
 * @param {string} keymatch - set to true if the array keys need to match as well i.e. ['a', 'b'] !== ['b', 'a'], default true

**example**
```javascript
var array1 = ['a', '1', '3'];
var array2 = ['b', '2', '4'];
var array3 = ['1', '3', 'a'];
var array4 = ['a', '1', '3'];

utility.isArrayEqual(array1, array2);  // false
utility.isArrayEqual(array1, array4);  // true
utility.isArrayEqual(array1, array3);  // false
utility.isArrayEqual(array1, array3, false);  // true

```

### convertCase
Convert all string elements of an array or object to lower/upper case

**arguments**
 * @param {string/array/object} target - array to be converted
 * @param {string} reqCase - case conversion required
 * @param {bool} - keyConvert - if true and target is an object, all keys will be case converted as well

**example**
```javascript
var upperCaseString = 'ABCDEF';
var upperCaseArray = ['A', 'B', 'C', 'D', 'E', 'F'];
var lowerCaseObject = {a: 'apple', b: 'ball'};

utility.convertCase(upperCaseString, 'tolowercase');  // 'abcdef'
utility.convertCase(upperCaseArray, 'tolowercase');  // ['a', 'b', 'c', 'd', 'e', 'f']
utility.convertCase(lowerCaseObject, 'touppercase');  // {a: 'APPLE', b: 'BALL'}
utility.convertCase(lowerCaseObject, 'touppercase', true); {A: 'APPLE', B: 'BALL'}
```

### inspect
Expand objects for display with console.log

Ordinarily console.log({a:{b}}) shows up as {a{object}} and does not give the details of {b}.  This function explodes all objects within other objects

 **arguments**
 * @param {object} toScreen - desired output to console.log

**example**
```javascript
var nestedObject = {a: {b: c: 3}};
consolelog(nestedObject);  // {a: [Object]}
console.log(utility.inspect(nestedObject));  
// displays
    {a:
      {b:
        {c: 3}
      }
    }
```

### caseBlindKeyMatch
Perform a case blind key match of an object

i.e. for object {Aa: 'one'}, key match search by 'Aa', 'aa' or 'aA' should return 'one'

**arguments**
 * @param {object} target - target object being searched
 * @param {string} needle - key to be matched

**example**
```javascript
var target = {Name: 'John'};
var needle = 'name';
var result;
result = target[needle]; // undefined
result = utility.caseBlindKeyMatch(target, needle);  // 'John'
```

---

## How Handyjs Works <a name='handy-works'></a>
This documentation section is designed to provide some background on the behind the scenes working of Handyjs so there is some context to the APIs.  It is not required reading in order to get up and started building apps on Handyjs.


### Bootstrap process
When starting an app built on Handyjs, the first function to execute should be the bootstrap initialization process

```javascript
handy.bootstrap.initialize()
```
(see [getting started](#getting-started) for an example).  The initialization process tries to read the configuration file (/handy/config/handy-config.js) in order to get the basic site and database configuration information.  If the configuration file is missing, initialization stops and the user is prompted to perform installation before continuing.

The configuration file provides the access credentials for the database.  Next, the initialization process sets up the database tables.  If the site configuration exists (this is different than the configuration file, this is a much more extensive collection of configuration settings and is stored in the database not a flat file), Handyjs loads this into memory.

After this, Handyjs creates all the Objects that are the parents for the other objects used in Handyjs (e.g. User, Content, etc).  The access control permissions system is started and permissions are granted to various defined roles.  The cron task management system starts up to manage tasks assigned to be executed periodically and finally the system logging is started.

If any of these systems fails, Handyjs assumes the installation has not yet occurred and prompts the user to perform the installation procedure.

### Account registration <a name="account-registration-link"></a>


---

## License <a name='license'></a>
Handyjs is freely available under the [AGPL License](link to AGPL license).
Unencumbered, commercial licenses are available at [Handyjs.org](http://www.handyjs.org/license)

---

## Credits <a name='credits'></a>
Handyjs was created by Tolu Akinola
Copyright StreamThing LLC