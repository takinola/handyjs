# Handyjs Documentation
<br/>
* [Introduction](#introduction)
* [Features](#features)
* [Dependencies](#dependencies)
* [Getting Started](#getting-started)
* [API Documentation](#api-docs)
* [How Handyjs works](#handy-works)
* [License](#license)
* [Credits](#credits)
<br/><br/>

---

---

## Introduction <a name='introduction'></a>
Handyjs is a web application template for building Nodejs applications.  Handyjs provides the basic functionality that almost all web apps need e.g. user account management, setting cron tasks, managing content or access control.  By using Handyjs, you can focus your development time more on the features that make your web application truly unique and less on creating generic, but necessary, functionality.  Handyjs also offers the advantage of offloading critical but easy to get wrong functionality like password management and access control so you can be sure your application is built on current best practice.
<br/><br/>

---

---

## Features <a name='features'></a>

### User account management<br/><br/>

#### Account registration  
Users can register accounts in order to gain privileges on your web app.  The conditions under which a user can create an account is governed by rules set by the site administrator.  Administrators can allow any visitor to create an account or require new accounts to obtain administrator approval prior to becoming active.  Administrators can also set customized emails to be sent automatically to users upon registration.  This can be anything from a simple welcome message to an email verification link.

Accounts can also be created for third parties by administrators.

(learn more about [account registration](#account-registration-link))<br/><br/>

#### Email verification
Administrators can require newly registered users to verify their email addresses by sending an email verification link to the email address used for registration.  The user account is not considered verified until the user follows the email verification link as proof that they have access to the emaila address used for registration.  The site administrators have the option to set restrictions on the functionality available to newly registered users until their email addresses are verified (e.g. comments or posts are not published until user accounts are verified)

(learn more about [email verification](#email-verification-link))<br/><br/>

#### User profile management
Users have profile pages where the information about their accounts can be displayed and modified.  Users have the option to change their usernames, email addresses, etc

(learn more about [user profile management](#profile-management-link))<br/><br/>

#### Password modification
Users can change their passwords either through their profile pages or by requesting a password reset (in the event they have forgotten their password and are unable to login to the site).  To request a password reset, the user simply enters the email address associated with their account and receives an email with a link to the password reset page. The password reset link is unique to each account and expires if not used within a specified amount of time (currently 24 hours)

(learn more about [password modification](#password-modification-link))<br/><br/>

#### User authentication
Users can login to the web app using their authentication credentials.  Once logged in, the web app maintains a session for the user to ensure each subsequent request can take advantage of any stored data (e.g. user roles, user ids, etc) about the user in order to present a personalized experience.

Users can logout in order to terminate the current session.

(learn more about [user authentication](#user-authentication-link))<br/><br/>

#### Account cancellation
Users can cancel their accounts in order to terminate their relationship with the web app.

(learn more about [account cancellation](#account-cancellation-link))<br/><br/>

#### Access Control
Administrators can set finely grained access control settings to determine what functionality is available to users.  Access control is maintained on a role basis whereby only users assigned to certain roles are allowed to perform certain actions.  Users can belong to one or more roles, some of which are assigned automatically (e.g. authenticated users) and others which may be assigned by the administrator.

(learn more about [access control](#access-control-link))<br/><br/>

#### Organization Accounts
Users can create a shared account for an organization.  The organizational account is managed by an admin (who has the role "org-admin") who has the ability to invite any other user to join the group or can remove any user account from the group.  Content created by any member of the organization is shared by all members of the organization.

(learn more about [organization accounts](#organization-account-link))<br/><br/>

---

### Content management<br/><br/>

#### Content creation
Users can create content to be stored in the web app.  Content created is automatically assigned a URL (if none is specified) and inherits any access control restrictions set by the administrator.  Each content created also stores associated meta-data (e.g. creator, date created/modified, rating, etc).  

Handyjs ships with two pre-defined content-types; Story and Comment.  Stories are simple content types with just a title and body.  Comments also have a title and body but have the special property of being able to be associated with other content i.e. a Story can have multiple Comments associated with it.  Essentially, with these two content types, it is possible to create a simple blogging platform with Handyjs right out of the box.<br/><br/>

#### Content editing
Users can edit content in the web app.  Any attributes of the content can be modified (e.g. titles, text, publish status, etc).  Whenever, content is modified, the relevant meta-data (e.g. last modified date) is also updated<br/><br/>

#### Content deletion
Users can delete content in the wb app.  Any deleted content will no longer be available to users without special permissions to access.<br/><br/>

#### Content publishing
Content is not generally available for access to users unless it is published.  This enables users to create "draft" content that is only visible to the creator.  Once published, the content becomes immediately available to all users with the appropriate permissions.<br/><br/>

#### URL management
All content is accessible via a url.  Users can assign a url when creating or editing content.  If no url is assigned manually, a url is generated automatically.  Handyjs ensures each url is unique to each content.  Also, each content has a permalink; a url that can never change.  This means links targeting the content permalink will never break even if the url for the content is modified.

(learn more about [content management](#content-management-link))<br/><br/>

---

### System management<br/><br/>

#### System configuration
Site administrators can modify the behaviour of web apps using a form based interface to set configuration options.  These options range from setting custom error pages (404 & 501 pages), deciding who can register and create new accounts, setting the frequency of site backups and log reports, etc.  <br/><br/>

#### Email
Handyjs web apps can send email using a dedicated email server or a transactional email service (Mandrill is the currently implemented option).  To send email using an email server, simply update the settings for the email server (address, port, user, password) or to use Mandrill, simply provide the Mandril API key. <br/><br/>

#### Cron
Functions can ben executed periodically by adding them to the list of cron tasks.  Handyjs monitors when last the function was executed and ensures cron tasks are performed on schedule.<br/><br/>

#### Sitemaps
All content created in Handyjs is automatically added to an XML sitemap.  Sitemaps are submitted periodically to the major search engines (Google and Bing are currently implemented)<br/><br/>

#### Analytics
Analytics tracking is enabled simply by providing the tracking code from the analytics service (Google Analytics is currently implemented) to the site configuration.<br/><br/>

#### Logging
Site activity can be logged via the Handyjs API.  Periodic log reports can also be generated and sent by email. <br/><br/>

#### Backups
Handyjs can create periodic database backups which can be saved to the server or delivered by email.<br/><br/>

(learn more about [system management](#system-management-link))<br/><br/>

---

---

## Dependencies<a name='dependencies'></a><br/><br/>
Minimum requirements  
* iojs 2.0.2 (with ES6 staging features enabled)
* Redis 2.8
* MySQL 5.6 <br/><br/>

---

---

## Getting started <a name='getting-started'></a>

### Directory structure
Download lastest version of Handyjs ([download from GitHub](http://www.github.com/takinola/handyjs)) and place in your project.  Install dependencies using npm.  

```
cd handy
npm install
```
<br/>
The typical file structure for a project built on Handyjs is as follows  
````
project folder
  |
  +- handy (handy files)
  |
  +- lib (project files)
  |
  +- node_modules (module dependencies installed with npm)
  |
  +- routes (routing files)
  |
  +- views (views files)
  |
  +- tests (test files)
  |
  +- docs (documentation)
  |
  +- app.js (initialization setup file) 

```
<br/>
**app.js**
```javascript
'use strict';

// require dependencies
let express = require('express')
  , path = require('path')
  , http = require('http')
  , favicon = require('serve-favicon')
  , handywrapper = require('./handy/lib/handy')
  , handy = handywrapper.get('handy')
  , project = require('./lib/project') 
  ;

let app = express();

// mount handy as a sub app
app.use(handywrapper);

// set project specific express configuration
const defaultPort = 2000;

// set environment variable PORT appropriately for sites hosted on the same server
app.set('port', process.env.PORT || defaultPort);

/* 
 * set routes
 * NOTE: Handy already reserves some routes for use (e.g. '/logout', '/login' etc.  See documentation for full list)
 * Handy routes take precedence over any new routes in the application
 */
let routes = require('./routes')(app);

// set public directory
app.use(express.static(path.join(__dirname, 'public')));

// set views
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// set up favicon
app.use(favicon(path.join(__dirname, path.join('public','img','favicon.ico'))));

/* handle 404 errors
 * NOTE: This should be the last app.use
 */
app.use(function(req, res, next){
  res.redirect('/notfound');
  return;
});

// Error Handler - used for project routes only i.e. native handyjs routes use a different error handler
app.use(function(err, req, res, next){
  handy.system.errorHandler(err, req, res, next);
});

// set initial function to run after Handy initialization is complete
handy.system.systemVariable.initialFunction = project.start;

// initialize handy and start project execution
handy.bootstrap.initialize()
.then(function(){
  return new Promise(function(resolve, reject){
    console.log('operating in ' + process.env.NODE_ENV + ' mode. \ninitialization complete...');
    resolve();
  });
})
.catch(function(err){
  console.log('operating in ' + process.env.NODE_ENV + ' mode.\ninitialization completed with errors: ', err);
  console.log('installation required');
});


// start server
http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

```
<br/><br/>

---

### Theming
Because Handyjs manages some routes for projects (e.g. login, site configuration, etc) it may be useful to modify the default theming to match the rest of the project.
CSS for theming is based on the [Bootstrap design framework](http://getbootstrap.com)

Handyjs theming (ie header, footer, additional css or scripts) can be modified in the site configuration ("/configuration/theme")<br/><br/>

---
### MySQL database setup
Set up a MySQl database and user by running the following commands

```mysql
CREATE DATABASE <databasename>;
CREATE USER '<user>'@localhost IDENTIFIED BY '<password>';
GRANT ALL PRIVILEGES on <databasename>.* TO '<user>'@localhost;
FLUSH PRIVILEGES;
```
<br/>

---
### Redis database setup
Ensure Redis is running<br/><br/>

---
### Installation
Start the app

```
iojs --es_staging app.js
```

Pointing the browser to the main page "127.0.0.1:2000" will redirect to the installation page (if not, go directly to "127:0.0.1:2000/install").  Provide the basic site information (site name, email address, database credentials) and the credentials for the site administrator.  Submitting the form runs the automatic installation script to prepare the MySQL and Redis databases and set up the site.

After installation is complete, the site administrator can set various site configuration options.<br/><br/>

---
### Routes
Handyjs controls the following routes.  Overriding these routes in your app may result in unpredictable behaviour (in short, do not override unless you really know what you are doing as some of the behaviour is subtle)

#### /install
The installation wizard.  It only needs to be run once; when the web app is started for the first time

#### /welcomepage
This is the default page authenticated users will see right after logging in.  A custom 'welcomepage' page can be specified in the site settings

#### /configuration
This is the directory pointing to the various site configuration pages.

#### /configuration/general
This page enables access to set most of the site configuration settings. 

#### /configuration/permisssions
This page provides a graphical UI to assign permissions and maintain the access control system

#### /configuration/theme
This page provides access to the site theme settings

#### /accessdenied
This is the default 403 page.  A custom 403 error page can be specified in the site settings

#### /notfound
This is the default 404 page.  Acustom 404 error page can be specified in the site settings

#### /cron
This is the path to activate cron.  Each site has a random cron path (e.g. /cron/random_string) to provide some security against DOS attack via cron

#### /sitemap.xml
This is the XML sitemap

#### /robots.txt
This is the robots.txt file

#### /contact
The site contact form

#### /login
User login page.  Users can login, register or request a password reset on this page

#### /logout
User logout

#### /user
Displays various views related to the user

If a user id is provided (e.g. '/user/9'), it displays the profile of the specified user.  If no parameters are provided, it displays the profile of the current user

#### /user/:id/password/:action
Displays a password change or reset form (depending on the specified 'action').  Password changes require the user to provide the current password whilst password resets only require the new password.  Password resets are used in the scenario where the user has forgotten their password.

#### /user/:id/account/cancel
Displays a page for the user to cancel their account.


#### /organization/register
Displays user registration for for organization admins.  Users who registering through this form create an organization and are registered as administrators for that organization

#### /organization/manage
Displays a page where the organization admin can add or remove user accounts from their organization
 
#### /content/create/:type
Displays a form for creating content.  For use only with content that ships with Handyjs (i.e. Story, Comment, Category).

#### /story/:id
Displays Story content specified by 'id' ('id' can be the permalink URI or the URL alias of the specified content)

#### /story/:id/edit
Displays a form to edit the Story content

#### /story/:id/delete
Displays a form to delete the Story content

#### /comment/:id
Displays Comment content specified by 'id' ('id' can be the permalink URI or the URL alias of the specified content)

#### /comment/:id/edit
Displays a form to edit the Comment content

#### /comment/:id/delete
Displays a form to delete the Comment content

#### /category/:id
Displays Category content specified by 'id' ('id' can be the permalink URI or the URL alias of the specified content)

#### /category/:id/edit
Displays a form to edit the Category content

#### /category/:id/delete
Displays a form to delete the Category content

#### /verifyemail/<random_string>
This path is used to verify user's email addresses.  When it is required to verify the user's email address (e.g. after a user registers a new account), an email is sent to the email address with a link to this page.  The link will include a random string which is checked against a record in the user account.

#### /requestonetimelink/<random_string>
This path is used to request special one-time links to be sent to user's email addresses (e.g. user requests a password reset email, waits until the password reset link has expired, when they try to use it, they get a message letting them know they will need to request a new password reset link by visiting this page)

#### /onetimelogin
This page provides a password reset screen to users who have utilized a forgotten password link.  It allows them to set a new password before continuing on to the rest of the site.
<br/><br/>  

---

---

## API Documentation <a name='api-docs'></a>

### System  
All System api calls are prefixed by handy.system i.e. to access system API 'doStuff', call handy.system.doStuff 

#### <br/>SystemVariable
systemVariable is the global variable used to pass data across modules in handyjs.  systemVariable has the following methods
  
**Get**  
Read a property of systemVariable

*arguments*
* @param {string} key - property to be read

*example*
```javascript
let installation_flag = handy.system.systemVariable.get('installation_flag');
```
<br/>
**Set**  
Set the value of a property of systemVariable

*arguments*
* @param {string} key - property to be set
* @param {various} value - value to set

*example*
```javascript
let key = 'installation_flag';
let value = true;
handy.system.systemVariable.set(key, value);
``` 
<br/>
**updateConfig**  
Set configuration values.  Configuration values are special in that they are stored in the database and are restored everytime the app starts.  There are also a number of default configuration values that are provided.

*arguments*
* @param {object} update - key value pairs for configuration items to be updated

*example*
```javascript
let update = {siteName: 'my first handyjs webapp'};
handy.system.systemVariable.updateConfig(update, callback);
```
<br/>
**getConfig**  
Get the value of a configuration property

*arguments*
* @param {string} key - name of configuration parameter to read

*example*
```javascript
let key = 'siteName';
let siteName = handy.system.systemVariable.getConfig(key);
```
<br/>
**initialFunction**  
initialFunction is the first function that is executed after handyjs boots up.  This should be set by the project accordingly.  

*example*
```javascript
function startProject(){
  console.log('handy is running and now my project is too');
}

handy.system.systemVariable.initialFunction = startProject;

```
<br/>

---

#### BaseObject
Handyjs has a default object that other object types (e.g. content and user objects) build upon.  This means object types built upon the base object inherit the methods and properties of the base object.

The properties of the base object are
* id: integer identification for each object (unique for each object type)
* createdate: time stamp indicating when the object was created
* modifydate: time stamp indicating last time the object was modified 
* deleted: indication of whether the object has been deleted ("true" means the object has been deleted)
* organization: organization that the object is a part of

BaseObjects have the following methods
<br/><br/>
**Get**  
Read the value of a property of the object.  Returns null if attribute does not exist

*arguments*  
* @param {string} key - property to be read

*example*  
```javascript
let newObject = new handy.system.BaseObject();
// ... do a bunch of stuff with newObject
let key = 'createdate';
let createDate = newObject.get('createdate');  
```
<br/>
**Set**  
Set the value of a property of the object

*arguments*
 * @param {string} key - the object property to be set
 * @param {all datatypes} value - the value to which the property is to be set

*example*
```javascript
let key = 'deleted';
newObject.set(key, true);
```
<br/>
**createTable**  
Create database tables to store object records.  This API function is only called during the bootstrap process and should NEVER be used under normal circumstances.  It is included in the documentation only for completeness

*arguments*  
None

*example*
```javascript
newObject.createTable(callback);
```
<br/>
**Load**  
Load object into memory from database

*arguments*  
 * @param {integer/string} id - unique identifier of the object being loaded
 * @param {string} type - type of identifier

*example*  
```javascript
let id = 55;
let type = 'id';
newObject.load(id, type, callback);
```
<br/>
**Save**  
Save object to database

*arguments*  
none

*example*
```javascript
newObject.save(callback);
```
<br/>
**cloneObject**  
Update all the properties of the object with those from the source
also performs some transformations e.g. transforms datetime strings into date objects

NOTE: This function bypasses the validation checks built into BaseObject.set so it is possible to have an object with the wrong value types (as compared to the schema definition)

*arguments*
 * @param {object} sourceObject - source object which provides all the properties

*example*
```javascript
let sourceObject = {
  id: 6,
  createdate: "Tue Aug 19 2014 02:56:35 GMT-0400 (EDT)",
  modifydate: "Tue Aug 19 2014 02:56:35 GMT-0400 (EDT)",
  deleted: false
}

let newObject = new handy.system.BaseObject();
newObject.cloneObject(sourceObject);
```
<br/>

---

#### systemMessage    
Set and retrieve system messages

System messages are used to inform the user of the state of the system (usually to indicate the result of some action taken)

*arguments*
 * @param {object} req - express request object
 * @param {string} msgType - types of system messages e.g. 'success', 'warning' and 'dev'
 * @param {string} msg - message for display
 * @param {bool} clearFlag - flag to delete messages after reading. Set to 'true' to delete messages (default)

*example*
```javascript
let msgType = 'warning';
let msg = 'Your password needs to be changed';
handy.system.systemMessage.set(req, msgType, msg);  // displays message to user asking them to change their password
```
<br/>

---

####restoreSystemMessage  
Restore system messages before a redirect.  This function is needed to resolve an edge case where system messages are set and then a redirect is issued.  Invoking res.redirect wipes out the previous res object.  This is a problem if the system messages have been transferred from req.session.msgCache to res.locals.sysmessage (as occurs after prepGetRequest has been called).  restoreSystemMessage moves the system messages safely back to req.session.msgCache.

NOTE: Invoke this function before res.redirect if another function (such as prepGetRequest) has moved system messages from req.session.msgCache to res.locals.sysmessage

*arguments*
 * @param {object} req - expresss request object
 * @param {object} res - express response object

*example*
```javascript
handy.system.prepGetRequest(options, req, res, function(err, pageInfo){
  handy.system.restoreSystemMessage(req, res);  // ensure system message are restored prior to redirecting
  res.redirect('/new/destination');
});
```
<br/>

---

#### sendEmail
Send email to receipient.

NOTE: if NODE_ENV !== 'production', emails will not be sent.  This is done so development or staging environments can test against live data safely.

Ensure all email related configuration settings are properly set otherwise this API call will fail

*arguments*
 * @param {object} receipient - email receipient (format: {name: <receipient name>, email: <receipient email>})
 * @param {object} sender - email sender's address (format: {name: <sender name>, email: <sender email>})
 * @param {string} subject - email subject
 * @param {object} body - email body as text and html. (format {text: <body as text>, html: <body as html>})
 * @param {string} cc (optional) - email cc's address (format: {name: <receipient name>, email: <receipient email>})
 * @param {array} attachment (optional) - array of attachments to email.  format of each attachment {path: <path>, name: <name of file>, data: <base64 data stream>, type: <file type>}
 * @param {string} replyAddress (optional) - reply to address for the email

*example*
```javascript
let receipient = {name: 'john', email: 'john@eample.com'};
let sender = {name: 'jill', email: 'jill@example.com'};
let subject = 'want to hike to the top of the hill?';
let body = {
  text: 'John\n, want to go hiking on the weekend?\n\nJill',
  html: '<html header-stuff><html><head></head><body><strong>John</strong><br/>want to go hiking on the weekend?<br/><br/>Jill</body></html>'
};
let attachment = {
  name: 'map_of_hill',
  path: '/path/to/image',
  type: 'image/jpeg'
};

handy.system.sendEmail(receipient, sender, subject, body, null, attachment, null, function(err){
  // email sent
});

```
<br/>

---

#### tokenReplace
Replace tokens in strings

*arguments*
 * @param {string} message - message on which to perform token replacement
 * @param {object} req - current request object
 * @param {object} currentUser - (optional) basis for token replacements regarding current user. If user argument is not provided, the current session user is assumed to be the current user

*example*
```javascript
let messageTemplate = '[site:name] message.  Hi [user:name], hope you are having a good day';
let message = handy.system.TokenReplace(messageTemplate, req);
console.log(message);  // 'Handyjs.org message.  Hi Bob, hope you are having a good day'
```
<br/>

---

#### recordUrlHistory
Keep a record of the user's url history (middleware). This is used to perform url redirects to any previous locations to use this as a regular function (as opposed to as middleware) just pass in a fourth parameter, regularFunctionFlag, which can be anything

*arguments*
 * @param {anything} regularFunctionFlag - indicates the function is not running as middleware

*example*
```javascript
app.get('/a/path', handy.system.recordUrlHistory, function(req, res){
  
});
```
<br/>

---

#### redirectBack
Redirect user to a url in their previous history

*arguments*
 * @param {number} steps - number of steps to go back in history (0 means current page)
 * @param {object} req - current request object
 * @param {object} res - current response object

*example*
```javascript
  handy.system.redirectBack(1, req, res);  // returns the user one page back in their history
```
<br/>

---

#### recordUrlAlias
Create and record URL aliases

Each content object can be accessed by two urls.  One Url is a perma-link (it never changes) and the other is an alias (which can be changed or modified).  This API call ensures the chosen Url alias is unique (to prevent inadvertent collisions).

This API is called automatically whenever any content object is saved.  Normally, it should not be necessary to access this API directly.  It is only included in the documentation for completeness.

*arguments*  
* @param {array} resource - the array of resources for which the URL alias is being created.  Each element can be a Content object or any other object with the following parameters - url: proposed url alias.  

This may be modified to ensure uniqueness.  For Content objects, the alias will be 'content/id' where id is the record of id of the corresponding contentlist entry

*example*
```javascript
var newContent = new handy.content.Story();  // create a new story instance
newContent.url = '/my/hopefully/unique/url';

handy.system.recordUrlAlias([newContent], function(err){
  
});
```
<br/>

---

#### runCron
Execute cron tasks

*arguments*
 * @param {obj} req - express request object
 * @param {obj} res - express response object

*example*
```javascript
handy.system.runCron(req, res, callback);
```
<br/>

---

#### addCronTask
Add tasks to cron

NOTE: task names are unique.  To prevent accidentally clobbering an existing task, prefix cron task names with the name of your app module e.g. 'mycoolapp send email newsletter'.

Cron is maintained in two separate places in systemVariable; cronTask and config.cronRecord.  

cronTask is formatted as {'task name': task function}.  This information is not persisted in the database and is reset each time the application is restarted

cronRecord is formatted as {task name: {freq: frequency, lastrun: time last run}}.  This information is stored in the database and is retrieved each time the app is started

Obviously cronTask and cronRecord must be kept in sync.  This is done by functions addCronTask and deleteCronTask

*arguments*
* @param {string} taskName - unique name to identify task. use human recognizable name e.g. 'nightly backup'
* @param {function} task - task to be run.
  * pass as 'null' if just updating the frequency
  * task will be run as task.bind(null, req, res)(callback)
  * task needs to return callback(null, {err: <any error>, key1: <string>, key2: <string>})
  * err should contain error objects
  * if no err, then there must be at least one key/value pair returned e.g. {'newsletter': 'sent succesfully'}  
* @param {string / integer} freq - frequency at which the task needs to be run.  specified in minutes (also accepts
   'hourly', 'daily', 'weekly')

*example*
```javascript
function longRunningProcess(callback){
  // do stuff
  return callback(null, {err: errorValue, result: resultValue});
}

/* this needs to run each time the app starts or restarts
    usually a good idea to run this right after bootstrap.initialize
*/
handy.system.addCronTask('myapp_cronLongRunningProcess', longRunningProcess, 'daily', callback);

```
<br/>

---

#### deleteCronTask
Remove cron task

*arguments*
 * @param {string} taskName - name of cron task to be removed

*example*
```javascript
let removeFunction = 'myapp_cronLongRunningProcess';
handy.system.removeCronTask(removeFunction, callback); // myapp_cronLongRunningProcess will no longer be executed on cron 
```
<br/>

---

#### backupDatabase
Backup database.  The backup is either sent to an email address or stored in a directory on the server, depending on the system settings

*arguments*
 * @param {object} req - express request object
 * @param {object} res - express response object

*example*
```javascript
handy.system.backupDatabase(req, res, callback);
```
<br/>

---

#### prepGetRequest
Prepare pageInfo object (pageInfo object contains rendering information for the page being prepared for display) for use in GET responses and performs a bunch of useful tasks common to all GETs

NOTE: Because this function moves the system messages from req.session.msgCache to res.locals.sysmessage, if there is a need to redirect afterwards, system messages NEED to be moved back to req.session.msgCache otherwise they will be lost as res.redirect creates a new res object.  Use restoreSystemMessage to preserve the system messages in this situation.

*arguments*
 * @param {object} option - custom information for this particular request.  is in the form {info:<info_option>, action:<action_option>}
 * @param {object} req - express request object
 * @param {object} res - express response object

*example*
```javascript
let pageTitle = 'Help page';
let options = {
  info: {
    title: 'Help page',  // sets the page title
    action: []  // can include any functions to automatically run
  }
};
handy.system.prepGetRequest(options, req, res, callback);
```
<br/>

---

#### logger
Define system logging.  Records system logs and generates reports

*arguments*
* @params {string} level - type of log level ('info', 'warn', 'error')
  * info - regular site operations e.g. GET requests successfully satisfied
  * warn - irregular activity e.g. 404 error, login failure
  * error - system error e.g. database read error, 
* @params {object} record - log object
  * format: logObject = {req: <express req object>, category: <log category e.g. "user" or "cron">, message: <descriptive message>), 
  * if logging an error, format is logObject = {error: <error object>, message: <description>}
 * @params {string/int} period (optional) - period for which the log report will cover 
  * format: (integer representing age in hours or string options 'hourly', 'daily', 'weekly', 'monthly')
  * if ommitted, period will use the systemVariable value of 'reportFreq'

*example*
```javascript

// record log event
let level = 'info';
let record = {
  req: req,
  message: 'user login successful',
  category: 'user',
  time: 'Tue Aug 26 2014 16:32:49 GMT-0700 (PDT)'
}

handy.system.logger.record(level, record);

// generate log report
let period = 'daily';  // generate report for the previous 24 hours
handy.system.logger.report(req, res, period, callback);  // log report is generated and sent to the destination assigned in the system settings

```
<br/>

---
#### errorHandler
Error handler for routes

*arguments*
 * @param {object} err - express error object
 * @param {object} req - express request object
 * @param {object} res - express response object
 * @param {object} next - express next object

*example*
```javascript
let err = new Error('access denied');
err.status = 403;

app.use(function(err, req, res, next){
  handy.system.errorHandler(err, req, res, next);
});

```
<br/>

---
#### display
display a page using the site theme settings

*arguments*
 * @param {object} req - express request object
 * @param {object} res - express response object
 * @param {string} view - jade view file
 * @param {object} locals - variables for display

*example*
```javascript
// userprofile.jade is the view file
// pageInfo is an object that contains the variables to be passed to the view
// pageInfo.theme may also specify a local jade file to override the site theme settings
// logDetail contains the log information
// {type: 'story', category: 'view', message: 'displaying story id 4'}

handy.system.display(req, res, 'userprofile', pageInfo, logDetail);

```
<br/>

---
#### getOrganizationName
get the name of an organization

*arguments*
 * @param {int} id - id of the organization

*example*
```javascript
let id = 67;
handy.system.getOrganizationName(id, function(err, name){
  console.log(name);  // 'bob corp'
})

```
<br/>

---

#### createNewOrganization
Creates a new organization record in the database  
This function returns an error if an organization already exists in the database with the same name

*arguments*  
* @param {string} org - new organization being created

*example*
```javascript
handy.system.createNewOrganization("jane and son's accounting")
.then(console.log);  // 5 - the id of the organization created in the database
```
<br/>

---

#### checkRecordIsUnique
Checks if a record in a database table is unique

*arguments*  
 * @param {string} table - table being checked
 * @param {string} column - column being checked
 * @param {string} record - record being checked for uniqueness

*example*
```javascript
handy.system.checkRecordIsUnique("user", "name", "bob")
.then(console.log);  // false 
```
<br/>

---

#### validateForm
Form validation.  This API makes various back-end checks on Handyjs forms to ensure the user input provided is suitable (e.g. required fields are provided, password confirmation fields match password field, emails are properly formatted, maximum string lengths are enforced, etc).

The function can be extended to provide custom validations

*arguments*
* @param {string} formType - type of form being validated e.g. userLogin, passReset, etc.  
  * Can also be a callback function to execute custom validation
* @param {req} Express request object
* @param {res} Express response object
* @param {next} Express next object

*example*
```javascript
 
app.post('/form/action', handy.system.validateForm('userRegister'), function(req, res){
  
});

// to perform a custom validation
function customValidation(req, res){
  // validation stuff
}

app.post('/form/action', handy.system.validateForm(customValidation), function(Req, res){
  
});
```
<br/>

---

#### findHandyDirectory
Gets the path to the handy directory folder.  This is useful for other functions that need to locate, create or delete files

*arguments*  
none

*example*
```javascript
let handyDirectory = handy.system.findHandyDirectory();  // returns '/path/to/handy/directory'
```
<br/>

---

#### getOrganizationStatus
Gets the pstatus assigned to an organization.  
Organization status is used to record information about that organization eg 'paid', 'suspended', 'flagged', etc  
When a user, who is part of the organization, is loaded, the organization status is transferred to the user.  This way, all the user inherits all the status of the organization while the status for all the users in an organization can be managed centrally

*arguments*  
none (The "this" of this function is tied to the object eg user)

*example*
```javascript
let bob = new user.User();
bob.getOrganizationStatus()
.then(console.log);  // ['paid']
```
<br/><br/>

---

### User
All User API calls are prefixed by handy.user i.e. to access user API "doStuff", call handy.user.doStuff

#### <br/>User
Creates a new User object
```javascript
let newUser = new handy.user.User();
```
<br/>
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
* role: array of roles assigned to the user
* status: an object with two properties each containing arrays.  first is the status tied to the particular user and the second is the status inherited from the organization the user belongs to  

User objects have the following methods
<br/><br/>
**load**  
Retrieves user record from database
 
*arguments*
 * @param {int/string} id - unique identifier of the user record
 * @param {string} type - type of identifier e.g. 'email' or 'id'

*example*
```javascript
newUser.load('john@doe.com', 'email', function(err){
  console.log(newUser);  // will display all the properties of the user record retrieved from the database
});

```
<br/>
**hash**  
Generate password hash (with optional salt, if salt is not provided, one is created automatically)
 
 *arguments*
 * @param {string} pwd - password to be hashed

*example*
```javascript
newUser.salt = 'cryptographically_random_salt';  // optional
newUser.hash('mysecurepassword', function(err){
  console.log(newUser.passwordhash);  // displays the created password hash
});
```
<br/>
**authenticate**  
Authenticates user based on email and password combination

NOTE: authentication does not create a session for the user.  It only
checks the validity of the email/password combination. If you
want to create a user session, use function 'login' (after authentication
of course)

*arguments*
 * @param {string} email - user email
 * @param {string} password - user provided unhashed password

*example*
```javascript
let email = emailFromUserLoginForm;
let password = passwordFromUserLoginForm;

newUser.authenticate(email, password, function(err){
  // if email and password combination are correct
  console.log(newUser.authenticated); // displays "true"

  // if email and password combination are incorrect
  console.log(newUser.authenticated); // displays "true"
});

```
<br/>
**login**  
Login user and create a session for this user.
NOTE: Ensure the user is authenticated (i.e. by running User.authenticate) first before creating a login session

*arguments*
 * @param {object} req - express request object

*example*
```javascript
newUser.login(req, function(err){
  console.log(newUser.role);  // displays ['authenticated']
  console.log(req.session.user); // displays newUser object
});
```
<br/>
**logout**  
Logout user and destroy session

*arguments*
 * @param {object} req - express request object

*example*  
```javascript
newUser.logout(req, function(err){
  // newUser.role will not contain ['authenticated']
  console.log(req.session.user); // displays "undefined"
});
```
<br/>
**createOneTimeLink**  
Create one time link used for email verification or password rest

*arguments*
 * @param {string} type - type of one time link, options are 'email', 'password'.
 option email generates one-time links that can only be used for email verification
 option password generates one-time links that can only be used for password modification e.g forgot password
 A one-time link generated for email verification cannot be used for password reset (and vice-versa)

*example*
```javascript
newUser.createOneTimeLink('email', function(err){
  console.log(newUser.onetimelink);  // displays cryptographically random string
  console.log(newUser.onetimelinktimestamp);  // displays time record of creating one-time link
});
```
<br/>
**verifyOneTimeLink**  
Verifies one-time link supplied by the user (usually as part of a link sent to the user by email) is correct and has not expired. 
If verification is successful, the one-time link is nulled out (to ensure it can only be used once)
NOTE: the verification of the one-time link is a comparison of hashes and not a straight string comparison i.e. a hash of the provided
one-time link is compared to the stored one-time link for the user 

*arguments*
 * @param {string} type - type of one-time link.  options are 'email' (for email verification) or password (for password resets)
 * @param {string} link - user supplied link to be tested
 * @param {int} daysToExpiry - (optional) length of time in days for the link to be considered expired.  0 means never expires 

*returns*  
Returns a verification flag (and the user object details if the verification is successful)
Return values are 'user not found', 'no previous request', 'link expired', 'match failed' & 'success'

*example*
```javascript
let type = 'email';
let oneTimeLink = 'string_extracted_from_link';
let daysToExpiry = 0;  // email verification links never expire but it is usually a good idea to expire password reset links after 24 hours
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
<br/>
**register**  
Creates new user account.

Upon registration, a number of automatic processes are carried out
* Welcome emails are sent to the email address associated with the new user account (may include an email verification link)
* User record is recorded in the database

*arguments*
 * @param {object} req - express request object

*returns*  
If registration is successful, returns calllback(null, 'loggedin') if new user is logged in, 
Returns callback(null, 'notloggedin') otherwise
All users are automatically assigned to "authenticated" role upon successful registration

*example*
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
<br/>
**initiatePasswordReset**  
Initiate a password reset e.g. user has forgotten their password and needs a password reset link sent to them
Sends an email with a one-time link to the user email address.  Following the link, takes the user to a page where they can create a new password
 
*arguments*
 * @param {object} req - express request object

*example*
```javascript
newUser.initiatePasswordReset(req, function(err){
  
});
```
<br/>
**cancelAccount**  
Cancels a user account preventing them from interacting with the web app again.
if the 'notify user of account cancellation' option is selected, a cancellation notice is sent to the user email address

*arguments*
 * @param {object} req - express request object

*example*
```javascript
newUser.cancel(req, function(err){
  
});
```
<br/>
**changePassword**  
Changes the password on user account

Currently their are two scenarios
1. change - the user is aware of their current password but wants to change it
2. reset - the user is unaware of their current password and wants to choose another one (e.g. first time login after an account has been created for you or when you reset your password)

*arguments*
 * @param {string} type - type of password change scenario ("change" or "reset")
 * @param {string} oldPassword - (optional, not required for type "reset") current password
 * @param {string} newPassword - new password 
 * @param {object} req - express request object

*example*
```javascript
let type = 'change';
let oldPassword = 'my_old_password';
let newPassword = 'my_super_secret_password';

newUser.changePassword(type, oldPassword, newPassword, req, function(err, loggedinStatus){
  // if password change is successful, user is logged in
  // if user login is successful
  console.log(loggedinStatus);  // displays 'loggedin'

  // if user login is unsuccessful
  console.log(loggedinStatus);  // displays 'notloggedin'
});
```
<br/>
**assignRole**  
Assigns a role to the user  
NOTE: All roles are lowercased by convention (i.e. "ABCD" === "abcd")
Also, the role will be automatically created if it does not already exist

*arguments*
 * @param {array} role - array of roles to which the user is being assigned

*example*
```javascript
let role = ['editor', 'premium member'];
newUser.assignRole(role, function(err){
  console.log(newUser.role);  // displays ['editor', 'premium member']
});
```
<br/>
**unAssignRole**  
Unassign a role from a user  
NOTE: All roles are lowercased by convention (i.e. "ABCD" === "abcd")

*arguments*
 * @param {array} role - roles from which the user is being unassigned

*example*
```javascript
let removeRole = ['premium member'];
console.log(newUser.role);  // displays ['editor', 'premium member']
newUser.unAssignRole(removeRole, function(err){
  console.log(newUser.role);  // displays ['editor']
});
```
<br/>

---

**findSharedOrganizationContent**  
find content that is shared with user from other members of the same organization  
NOTE: use this function to safely find content as it prevents content from leaking
from one organization to another

*arguments*
 * @param {string} type - content type
 * @param {object} criteria - search criteria required to match
 * @param {object} options - search options

*example*
```javascript
let type = 'bugReport';
let criteria = {
  status: 'open',
};
let options = {
  count: 10,
  offset: 0,
  commentCount: false
};  // return only ten results, starting from the most recent results and do not return the number of comments associated with each return content

let bob = new handy.user.User();  // where bob.organization is 'myCompany'

bob.findSharedOrganizationContent(type, criteria, options, function(err, results){
  console.log(results);  // displays array of matching content objects
  /*
  results [
    {id: 4, published: true, status: 'open'}, {id: 77, published: false, status: 'open'}
  ]
  */
});
```
<br/>

---

#### requireAuthenticationStatus
Middleware to check authentication status of current user session

*arguments*
 * @param {string} status - authentication status to verify (options 'authenticated' or 'unauthenticated')

*example*
```javascript
app.get('/some/path/only/available/to/authenticated/users', handy.user.requireAuthenticationStatus('authenticated'), function(req, res){
  req.send('this should only be displayed to authenticated users.  unauthenticated users should get a 403 error')
});
```
<br/>

---

#### approveAccountRegistrationRequest
Enables administrators or appropriately permission users to approve user registration requests (for the case where the "who can register accounts" option is set to "users, but with administrator approval")
This function sets the account verified flag to true for each user registration request approved, meaning the user will not be required to verify their email addresses.
Notification emails will be sent to each approved user account.

*arguments*
 * @param {array} uidList - list of ids for users pending registration to be approved
 * @param {object} req - express request object

*example*
```javascript
let uidList = [6, 9, 24];  // list of user ids for accounts to be approved
handy.user.approveAccountRegistrationRequest(uidList, req, function(err){
  
});
```
<br/>

---

#### checkPermission
Check the user has the appropriate permissions to perform a task  
NOTE: This function works as both middleware or as a straight function.

To access the straight functionality, include a callback function which will be returned as callback(err, status) with 'status' indicating whether permission was granted or not

*arguments*
 * @param {int} userId - user id for user whose permissions are being checked - optional
 * @param {string} resource - resource being checked for permission to access
 * @param {array} task - array of tasks being checked for permission to perform.  tasks are OR'ed (i.e. return true if permission exists for just one of the tasks)
 * @param {object} req - express request object
 * @param {object} res - express response object

*example*
```javascript
// middleware example
app.get('/path/only/accessible/to/users/with/admin/roles', handy.user.checkPermission('system.System', ['can modify site configuration']), function(req, res){
  res.send('only users with the appropriate roles will see this message.  all others will get a 403 error')
})

// straight function example
let uid = 56;  // id of user whose permissions are being checked
let resource = 'system.System';
let task = ['can modify site configuration'];
handy.user.checkPermission(uid, resource, task, function(err, flag){
  console.log(flag); // displays "true" if user has the appropriate permissions, otherwise "false"
})(req, res);
```
<br/>

---

#### checkUserHasSpecificContentPermission
Check if user has the permission to modify/delete this specific content i.e. they have permission to modify/delete all content or in the case where this content belongs to them, they have permission to modify/delete their own content
 
 *arguments*
 * @param {object} req - express request object
 * @param {object} res - express response object
 * @param {integer} uid - user id
 * @param {string} contentType - content type
 * @param {integer} urlId - content id
 * @param {string} actionType - type of action being performed i.e. 'edit' or 'delete'

*example*
```javascript
let uid = 56; // id of the user whose permissions are being checked
let contentType = 'story';  // type of content
let urlId = 25; // id of content
let actionType = 'delete';  // action being performed on the content

handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, actionType, function(err, flag){
  console.log(flag); // displays "true" if user has the appropriate permissions, otherwise "false"
});
```
<br/>

---

#### updateRolePermission
Update resource permissions for roles  
NOTE: Updates replace any previous permission settings for each role / resource e.g. if role "A" has permission "b" on resource "c", updating permission "d" on the same role / resource relationship will result in permission "b" being removed.  In order, to add permissions, both current and new permissions must be provided.

*arguments*
 * @param {array} roleResourcePermissionList - array of role resource permission objects used to perform update format [{role: myrole, resource: myresource, permissions: [list of permissions]}, {...}, {...}]

*example*
```javascript
let roleResourcePermissionList = [
  {role: 'premium user',
   resource: 'content.Podcast',
   permissions: ['can submit new podcast', 'can access podcasts']
  }
];
handy.user.updateRolePermission(roleResourcePermissionList, function(err, roleResourcePermissionList, rolesPermissionGrant){
  console.log(rolesPermissionGrant); // displays rolesPermissionGrant object which contains all the permission grants for each role in the system
});
```
<br/>

---

#### createRole
Create a new role which may be assigned to users

*arguments*
 * @param {string} newRole - new role to be created (will be lowercased)

*example*
```javascript
let newRole = 'super users';
handy.user.createRole(newRole, function(err){
  
});
```
<br/>

---

#### deleteRole
Delete a role so it can no longer be assigned to users

*arguments*
 * @param {string} role - name of role to be deleted

*example*
```javascript
let role = 'super users';
handy.user.deleteRole(role, function(err){
  
});
```
<br/>

---

#### aclReset
Reset access control system  
Access control settings are maintained in the Redis database, however, it is possible for the Redis db to become corrupted or deleted.  In the case of such an event, this function will restore the access control settings.

*arguments*
none

*example*
```javascript
aclReset(function(err){
  
});
```
<br/>

---

#### initializePermissionGrants
Initialize permission grants to various roles and updates the Redis database.
Basically, it takes the list of resources and associated permissions and grants all to the administrator role then, it goes through each other role and grants them requested permissions.  

Also, all roles, resources and tasks are lowercased (i.e. 'ABCD' === 'abdc')

NOTE: Under normal circumstances, there should NEVER be a need to use this API function as it is only required during the bootstrap process.  It is included in documentation only in the interest of completeness

*arguments*
none

*example*
```javascript
handy.user.initializePermissionGrants(function(err){
  
});
```
<br/>

---

#### postUserVerificationProcessing
Post user verification processing performs a number of tasks whenever a user account has been verified e.g. any content created by an unverified user is automatically set to "unpublished" (i.e. it is not visible on the site) but once the user becomes verified, all their draft content gets published.
This function should be called each time a user account is verified
 
 *arguments*
 * @param {array} uidList - array of ids of users that have been verified

*example*
```javascript
let uidList = [45, 78, 89];  // list of ids for user accounts which have just been verified
handy.user.postUserVerificationProcessing(uidList, function(err){
  
});
```
<br/><br/>

---


### Content
All Content API calls are prefixed by handy.content i.e. to access content API "doStuff", call handy.content.doStuff

#### <br/>Content  
Creates a new content object

*example*
```javascript
let content = new handy.content.Content();
```
<br/>
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


New instances of content can be created using the createNewInstance API (see documentation for full details)
```javascript
let newContent = handy.content.createNewInstance('bugReport')
```
<br/>
Content objects have the following methods (other methods can be added by specifying as part of "definition.init")

<br/>
**Publish**  
Publish content

*arguments*  
none

*example*
```javascript
newContent.publish(function(err){
  console.log(newContent.published);  // displays "true"
});
```
<br/>
**Unpublish**  
Unpublish content and set to draft mode

*arguments*  
none

*example*  
```javascript
newContent.unpublish(function(err){
  console.log(newContent.published);  // displays "false"
})
```
<br/>
**Rate**  
Rate content

*arguments*  
@params {int} rating - rating of content on a scale of 0 - 10

*example*  
```javascript
newContent.rate(6, function(err){
  console.log(newContent.rating);  // displays "6"
});
```
<br/>
**Save**  
Save content to database

*arguments*  
none

*example*  
```javascript
newContent.save(callback);
```
<br/>
**Load**  
Load content from database.  If the content is in the cache, the cached object will be loaded instead

*arguments*  
 * @param {integer} id - id of content being loaded
 * @param {string} type - type of identifier i.e. 'id'

*example*  
```javascript
let id = 44;  // id of content to be loaded
let type = 'id';  // specifying that the unique identifier is an "id"
newContent.load(id, type, function(err){
  console.log(newContent);  // displays stored value of bugReport with id of 44
})
```
<br/>

**getRelatedContent**  
Get content that is related to this content instance e.g. get all the comments associated with a particular content

*arguments*  
 * @param {string} type - type of related content to be returned

*returns*  
returns an array of related content objects e.g.
```
[
  {related content object #1}, {related content object #2}, {related content object #3}, ...
]
```
*example*  
```javascript
let type = 'comments';  // return comments related to this content
newContent.getRelatedContent(type, function(err, results){
  console.log(results);  // displays array of related comments
});
```
<br/>

---

#### createContent  
Create new content.  This API is a wrapper function for the Content.save API.  It is used particularly to create content based on the result of a form submission.  It is required so that the form processing will not be too unweidly
 
*arguments*  
* @param {string} type - type of content being created  
* @param {object} seed - parameters of the object to be created.  If the content type is not a standard Handy object, the key/values of seed will be transfered without any transformations  

*example*  
```javascript
let type = "bugReport";
let seed = {
  published: true,
  status: 'resolved'
};
handy.content.createContent(type, seed, callback);
```
<br/>

---

#### createNewInstance  
Create new instance of a content type

*arguments*  
 * @param {string} contentType - type of content for which a new instance is required

*example*  
```javascript
let newContent = handy.content.createNewInstance('bugReport');
```
<br/>

---

#### createNewContentType  
Create new content types  
This function allows the programatiic expansion of content types i.e. new content types can be defined at run time and they will inherit all the methods and properties of the existing Content object.  This ensures content types in future projects do not break when the Content object is upgraded
 
 *arguments*  
 * @param {array} contentTypes - Collection of content types to be created.  
    * format [{name: contentType name, definition: additional methods and properties of content type}]
    * format of definition
      {<br/>&nbsp;&nbsp;init: additional properties for the new content type<br/>&nbsp;&nbsp;schema: additional database schema definitions for the new content type<br/>}

*example*  
```javascript
let bugReport = {
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
let contentType = [bugReport];

handy.content.createNewContentType(contentType, function(err){
  
});
``` 
<br/>

---
#### defineNewContentType  
Define new content types  
This function allows the programatiic expansion of content types i.e. new content types can be defined at run time and they will inherit all the methods and properties of the existing Content object.  This ensures content types in future projects do not break when the Content object is upgraded

*arguments*
* @param {string} type - name of new content type.  should be unique to avoid clobbering existing content types
* @param {object} contentDefinition - definition of the new content type.
  * format: {<br/>&nbsp;&nbsp;init: additional properties for the new content type<br/>&nbsp;&nbsp;schema: additional database schema definitions for the new content type<br/>}

*example*
```javascript
  // define new content types
  let defineSubscriber = {
    init: {
        firstname: null,
        email: null,
        subscribed: false
      },
    schema: {
        columns:{
          firstname: {type: 'VARCHAR', size: 256, null: true},
          email: {type: 'VARCHAR', size: 256, null: true},
          subscribed: {type: 'BOOL', null: false, default: false}
        }
      }
  };

  let newContent = [
    {name: 'Subscriber', definition: defineSubscriber}, 
  ];


  handy.content.createNewContentType(newContent, function(err, results){
    // new content type called 'Subscriber' is now available
    let bob = new Subscriber();
  });
```

<br/>

---

#### findContent  
Find content based on search criteria

*arguments*  
 * @param {string} type - content type
 * @param {object} criteria - search criteria required to match
 * @param {object} options - search options


*example*  
```javascript
let type = 'bugReport';
let criteria = {
  status: 'open',
};
let options = {
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
<br/>

---

#### findContentFromAlias  
Get the content url and id associated with an alias.

This API is used in retrieving the appropriate content for routes accessed via the content alias.

For example, GET '/content/15' -> GET 'story/jack-and-jill'  

*arguments*  
 * @param {int} aliasId - id of alias to be translated into the associated content id and url

*example*  
```javascript
app.get('/content/:alias', function(req, res){
  let contentDetails = system.findContentFromAlias(req.params.alias); // {id: 6, url: '/story/jack-and-jill', type: 'story'}
});
```
<br/>

---

#### submitXMLSitemap  
Submit sitemap to search engines (Google and Bing)

*arguments*  
 * @param {object} req - express request object
 * @param {object} res - express response object

*returns*  
This function is meant to be run as a cron task therefore the format of the callback is callback(null, err, result)

*example*  
```javascript
handy.content.submitXMLSiteMap(req, res, callback)
```
<br/>

---

#### getCategorySelectOptions  
 Convenience function to prepare category options in format suitable for display.  Prepares the category hierarchy for display in format 
 garndparent -> parent -> child
 
 *arguments*  
 * @param {object} defaultObj - default category; used to determine when 'selected' is true (optional)
 * @param {string} type - identifies which type of default match is required.  'self' matches default object, 'parent' matches object's parent (optional)

*returns*  
returns categories in format
```
[
  {value: <val>, selected: true/false, text: 'grandparent -> parent -> child', name: <category name>}, {etc}
]
```
<br/>

---

### Special Content Types
<br/>
#### Categories  
Categories are not strictly "content" types.  Category objects only inherit the default methods and properties of default system objects. Categories, however, have an additional property "parent".  The parent proprty of a category refers to the id of another category.

*example*  
```
let animal = new handy.system.category();
console.log(animal.id);  // let's say the id for animal is 42
let dog = new handy.system.category();
dog.parent = 42;  // set "dog" category as a child of the "animal" category
``` 
<br/>
#### Story  
Story is one of the two content types that ships with Handyjs.  It has only the default methods and properties of Content types
<br/><br/>
#### Comment  
Comment is one of the two content types that ships with Handyjs.  It has only the default methods and properties of Content types.
<br/>

---
### Contentlist  
Contentlist is a table that contains a record for each content created.  
It is used to derive permalinks for content and also to find relationships between content.  
It has the following fields
* type - this is the type of content it references eg. 'story'
* typeid - this is the id of the specific content referenced by this entry
* relatedto: this is any other content that the content referenced by this entry is related to

*example*
```javascript
  /*
   * story is a story content instance with {id: 54, contentid: 14, url: 'mystory'}
   * comment is a comment content instance with {id: 36, relatedto = 14}
   * contentlist has a record {id: 14, type: 'story', typeid: 12}
   * 
   * It will be possible to view the story at either 'story/mystory' or 'content/14'
   * Also, story.getRelatedContent('comment') will return the comment with id 36
   */

```
<br/><br/>
---

---

### Utility
All Utility API calls are prefixed by handy.utility i.e. to access utility API "doStuff", call handy.utility.doStuff

The Utility API consists of "helper" functionality for the other Handyjs modules.  Basically, if there is some functionality that is required repeatedly by other modules, it will live in the Utility module.
<br/>

---

#### subClass
subClass is used to manage prototypical inheritance of objects.  Central to the architecture of Handyjs is a set of objects inheriting methods and properties from each other.  subClass converts an object into a Child class of another Parent object.

*Handyjs Object Inheritance Model*
```
BaseObject
  |
  +- User
  |
  +- Content
  |   |
  |   +- Story
  |   |
  |   +- Comment
  |
  +- Category

```
<br/>
*arguments*
* @param {object} parent - parent class
* @param {object} child - child class

*example*
```javascript
function Child(){
  let param1 = {key: val};
  let param2 = {key: val};
  Parent.call(this, param1, param2); // set up object using the methods and properties of Parent
}

utility.subClass(Parent, Child);  // Child now inherits the methods and properties of Parent but has its own constructor
```
<br/>

---

### populateNewObject
populateNewObject is used to populate attributes of new object instances by iterating over an initializing object which contains all the attributes i.e. send in an object like {key1: val1, key2: val2} and the created object instance will have this.key1 = val1 and this.key2 = val2

*arguments*  
* @param {object} initObject - initializing object

*example*  
```javascript
function emptyObject(initializer){
  utility.populateNewObject.call(this, initializer);  // set up the properties of this object based on the values in initializer
}
```
<br/>

---

### removeLastCharacter
Remove last occurence of a character from a string.  Particularly useful to remove trailing comma from strings generated in loops e.g. "string1, string2, string3,"

*arguments*  
* @param {string} char - character or string to be removed
* @param {string} string - string to be modified

*example*  
```javascript
let modString = 'Andy + Bob + Candy + Dan +';
let finalString = utility.removeLastCharacter(' +', modString); // 'Andy + Bob + Candy + Dan'
```
<br/>

---

### escapeRegExp
Escape string characters to be used as literal string within a regular expression

*arguments*  
* @param {string} string - string to be escaped

*example*  
```javascript
let message = '[user name] needs to do a bunch of stuff.  [user name] should do it now';
let re = new RegExp(utility.escapeRegExp('[user name]'), 'g');
let userName = 'Dan';
let newMessage = message.replace(re, userName);
```
<br/>

---

### checkUniqueRecord
Check if a record in a database table is unique e.g. check to see if there is more than one user with the same email address 

*arguments*  
 * @param {object} recordToTest - record being checked for uniqueness.  format {column: columnname, value: recordvalue}
 * @param {object} expectedRecord - (optional) an existing record in the database which can be ignored.  if null, it is assumed there should be no occurences of the record in the table
 * @param {string} table - table in which to search for uniqueness

*returns*   
format callback(err, uniqueFlag) where uniqueFlag is true if the recordToTest is unique and false otherwise

*example*  
```javascript
let recordToTest = {
  column: 'email',
  value: 'bob@gmail.com'
};

// we expect to find a record for bob@gmail.com with an id of 6 so ignore this record if found
let expectedRecord = {
  column: 'id',
  value: 6
};

utility.checkUniqueRecord(recordToTest, expectedRecord, 'user', function(err, uniqueFlag){
  console.log(uniqueFlag);  // 'true' if there is no other record in 'user' table other than the expected one (false otherwise)
});
```
<br/>

---

### isArrayEqual
Check if two arrays are equal to each other.

For some reason javascript does not return true for ['a'] === ['a'] so this function returns true if both arrays are the same, false otherwise

*arguments*  
 * @param {array} array1 - first array to be used for comparison
 * @param {array} array2 - second array to be used for comparison
 * @param {string} keymatch - set to true if the array keys need to match as well i.e. ['a', 'b'] !== ['b', 'a'], default true

*example*  
```javascript
let array1 = ['a', '1', '3'];
let array2 = ['b', '2', '4'];
let array3 = ['1', '3', 'a'];
let array4 = ['a', '1', '3'];

utility.isArrayEqual(array1, array2);  // false
utility.isArrayEqual(array1, array4);  // true
utility.isArrayEqual(array1, array3);  // false
utility.isArrayEqual(array1, array3, false);  // true

```
<br/>

---

### convertCase
Convert all string elements of an array or object to lower/upper case

*arguments*  
 * @param {string/array/object} target - array to be converted
 * @param {string} reqCase - case conversion required
 * @param {bool} - keyConvert - if true and target is an object, all keys will be case converted as well

*example*  
```javascript
let upperCaseString = 'ABCDEF';
let upperCaseArray = ['A', 'B', 'C', 'D', 'E', 'F'];
let lowerCaseObject = {a: 'apple', b: 'ball'};

utility.convertCase(upperCaseString, 'tolowercase');  // 'abcdef'
utility.convertCase(upperCaseArray, 'tolowercase');  // ['a', 'b', 'c', 'd', 'e', 'f']
utility.convertCase(lowerCaseObject, 'touppercase');  // {a: 'APPLE', b: 'BALL'}
utility.convertCase(lowerCaseObject, 'touppercase', true); {A: 'APPLE', B: 'BALL'}
```
<br/>

---

### inspect
Expand objects for display with console.log

Ordinarily console.log({a:{b}}) shows up as {a{object}} and does not give the details of {b}.  This function explodes all objects within other objects

 *arguments*  
 * @param {object} toScreen - desired output to console.log

*example*  
```javascript
let nestedObject = {a: {b: c: 3}};
consolelog(nestedObject);  // {a: [Object]}
console.log(utility.inspect(nestedObject));  
/* displays
    {a:
      {b:
        {c: 3}
      }
    }
*/
```
<br/>

---

### caseBlindKeyMatch
Perform a case blind key match of an object

i.e. for object {Aa: 'one'}, key match search by 'Aa', 'aa' or 'aA' should return 'one'

*arguments*  
 * @param {object} target - target object being searched
 * @param {string} needle - key to be matched

*example*  
```javascript
let target = {Name: 'John'};
let needle = 'name';
let result;
result = target[needle]; // undefined
result = utility.caseBlindKeyMatch(target, needle);  // 'John'
```
<br/>

---

### generateRandomString
Generate a random string eg for use as a session key

*arguments*  
* @param {int} len - length of string (default value of 15)

*example*  
```javascript
let randomString = handy.utility.generateRandomString(15); // something like 'erfgnd3#WaHL0PX'
```
<br/>

---

### trimFormTextEntries
Trims any text entry in a submitted form to remove whitespaces

*arguments*  
* @param {obj} form - req.body object coming from the form

*example*  
```javascript
// req.body.name === '  Bob  '

req.body = handy.utility.trimFormTextEntries(req.body);

// req.body.name === 'Bob'

```
<br/>

---

### validateEmailAddress
Validate email addresses to check if they are valid.  Returns true or false.  
Checks to see if the email has the format "something@something"

*arguments*  
* @param {string} email - email address to be validated

*example*  
```javascript
let bobEmail = 'bob@gmail.com';
let carolEmail = 'carol.gmail.com';
handy.utlity.validateEmailAddress(bobEmail);  // true
handy.utlity.validateEmailAddress(carolEmail);  // false

```
<br/><br/>

---

---

## How Handyjs Works <a name='handy-works'></a>
This documentation section is designed to provide some background on the behind the scenes working of Handyjs so there is some context to the APIs.  It is not required reading in order to get up and started building apps on Handyjs.
<br/>

---

### Bootstrap process
When starting an app built on Handyjs, the first function to execute should be the bootstrap initialization process

```javascript
handy.bootstrap.initialize()
```
<br/>
(see [getting started](#getting-started) for an example).  The initialization process tries to read the configuration file (/handy/config/handy-config.js) in order to get the basic site and database configuration information.  If the configuration file is missing, initialization stops and the user is prompted to perform installation before continuing.

The configuration file provides the access credentials for the database.  Next, the initialization process sets up the database tables.  If the site configuration exists (this is different than the configuration file, this is a much more extensive collection of configuration settings and is stored in the database not a flat file), Handyjs loads this into memory.

After this, Handyjs creates all the Objects that are the parents for the other objects used in Handyjs (e.g. User, Content, etc).  The access control permissions system is started and permissions are granted to various defined roles.  The cron task management system starts up to manage tasks assigned to be executed periodically and finally the system logging is started.

If any of these systems fails, Handyjs assumes the installation has not yet occurred and prompts the user to perform the installation procedure.

### Account registration <a name="account-registration-link"></a>
to be updated  <br/><br/>
### Email Verification <a name="email-verification-link"></a>
to be updated  <br/><br/>
### Profile management <a name="profile-management-link"></a>
to be updated  <br/><br/>
### Password management <a name="password-management-link"></a>
to be updated  <br/><br/>
### User authentication <a name="user-authentication-link"></a>
to be updated  <br/><br/>
### Account cancellation <a name="account-cancellation-link"></a>
to be updated  <br/><br/>
### Access control <a name="access-control-link"></a>
to be updated  <br/><br/>
### Organization account <a name="organization-account-link"></a>
to be updated  <br/><br/>
### Content management <a name="content-management-link"></a>
to be updated  <br/><br/>
### System management <a name="system-management-link"></a>  
to be updated  <br/><br/>

---

---

## License <a name='license'></a>
Handyjs is freely available under the [AGPL License](http://www.gnu.org/licenses/agpl.html).<br/>
Unencumbered, commercial licenses are available at [Handyjs.org](http://www.handyjs.org/license)
<br/><br/>

---

---

## Credits <a name='credits'></a>
Handyjs was hand crafted from a single block of sustainably grown javascript by Tolu Akinola<br/>
&#169;&nbsp; 2014 StreamThing LLC