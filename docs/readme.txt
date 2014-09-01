Handy.js
Revision date: 10/06/2013
 
Introduction
Handy.js is a CMS based on the Node.js framework.  The design philosophy for Handy.js is simplicity, speed and extensibility.  This means the user with basic technical skills should be able to get up and running very quickly while a more advanced user should be able to extend the functionality and features very easily.

Dependencies
Node.js v??
MySQL v??
Redis v??


Installation


File Structure
  handy
      |- doc  -> documentation (including this readme file)
      |- lib  -> javascript files
      |- node_modules -> npm module installation folder
      |- tests -> test folder

  public
      |- css -> style definitions
      |- img -> image files
      |- js -> scripts
      
  routes -> routes folders

  views -> pages view templates
      |- includes
          |- blocks -> blocks
          |- components -> small components e.g. csrf form insert
          |- forms -> all forms
          |- scripts -> all scripts
  app.js -> main application file
  config.js -> configuration file


Functionality
Handy.js provides a bunch of CMS related functionality right out of the box. This functionality is grouped in categories and each category has a file in the /handy/lib/ folder.  Each function can be accessed by calling handy.category.function() (from outside the handy folder) or category.function() (from within the handy folder) or directly as function() (from within the category itself).

  system.js - provides system management functions
    systemVariable.get
      arguments
        key -> property name of variable requested
      
      description
        return the value of the requested global systemVariable
    
    systemVariable.set
      arguments
        key -> property name of variable to be set
        value -> value to be assigned to the property
      
      description
        set the value of a property of the global systemVariable
  
    BaseObject
      arguments
        objectInitializer -> object containing properties to be assigned to the newly created BaseObject
        schema -> database schema to record object instances
      
      description
        BaseObject is the base object on which most other objects in handy base their inheritance.  BaseObject provides a bunch of basic methods and properties common to most data constructs in handy
    
    BaseObject.get
      arguments
        attribute -> property name being requested
        
      description
        get the value of a property of the BaseObject instance
    
    BaseObject.set
      arguments
        attribute -> property being changed
        value -> value to be assigned to the property
        callback -> function callback upon completion
      
      description
        set the value of a property of the instance of BaseObject
    
    BaseObject.delete
      arguments
        none
      description
        set the deleted flag for this instance of BaseObject
    
    BaseObject.undelete
      arguments
        none
      description
        unset the deleted flag for this instance of BaseObject
    
    BaseObject.createTable
      arguments
        pool -> database connection pool
        callback -> function callback upon completion
      
      description
        create the database table that will hold records for instances of BaseObject
    
    BaseObject.load
      arguments
        id -> id of the record to load from the database
        pool -> database connection pool
        callback -> function callback upon completion
      
      description
        load record from the database and populate an instance of BaseObject with the data
    
    BaseObject.save
      arguments
        pool -> database connection pool
        callback -> function callback upon completion
      
      description
        save object as database record
    
    validateForm
      arguments
        formType -> type of form being validated
      
      description
        validate form input to ensure fields are completed correctly and submitted with the appropriate datatypes
         
    
      


  userFn.js - provides user management functions
    hash
      arguments
        pwd -> password to be hashed
        salt (optional) -> salt to use for hashing
        fn -> callback function once hashing is complete.  If not salt is provided, a new salt is generated and returned with the callback

      description
        generate a salted hash for a given password.  generates the salt as well if none is provided

    authenticate
      arguments
        uname -> username to be authenticated
        pass -> corresponding password for username
        fn -> callback function upon completion of authentication

      description
        authenticate a given username and password combination

    load
      arguments
        id -> username or uid of user
        fn -> callback function upon completion of user load

      description
        return a user object that matches the given username or user id
          
    



Display
Handy.js uses the standard Node.js methodology for displaying output.  Routes are defined for all valid requests, each route has a specified views layout to display the output and the layouts are composed of various components.  

  Routes
    All routes are maintained in /routes/.  /routes/index.js provides links to all the other routing files.

    Route Access Control
      Each route requiring access control should specify the middleware needed with appropriate parameters.  Currently available access control middleware are listed as follows.  Please note access control functions are called from the user module.

        requireAuthenticated - provide access based on the authentication status of the current user.  If provided parameter 'authenticated', it provides access only to authenticated users.  If provided parameter 'unauthenticated', it provides access only to unauthenticated users.

        requireRoles - provide access based on roles the user is assigned to. Parameters are an array of roles.  Any user assigned to one or more of these roles will have access granted.
        
        /**Route History Tracking i.e. recordUrlHistory & redirectBack******/

  Views
    Views use the Jade templating language.  Jade is a templating language engine that enables creation of HTML documents in a fairly terse manner.  You can learn more about Jade at jade-lang.com.  There are other templating languages but only Jade is supported at this time.  You are, of course, free to write your views and layouts in standard HTML.

    Layouts also use the Twitter Bootstrap css framework for styling.  Twitter Bootstrap is an elegant css framework that enables the creation of elegant, cross-browser compliant styling very quickly.  Learn more about Twitter Bootstrap at http://twitter.github.io/bootstrap.  You are, of course, free to use other css frameworks (or none at all) by removing the links to the Twitter Bootstrap css and js files in the layouts used and deleting the files from the /public/css/ and /public/js/ respectively.

  Forms
    All forms are available in /views/includes/forms/.  Forms can be inserted anywhere on a page simply by adding " include includes/forms/form_name".  It is advisable to utilize the pre-built forms rather than creating your own as they already include protection for CSRF attacks and validation (both client and server side).

    Form building
    To create your own form, place the file, <form name>.js, in the /views/includes/forms/ directory.  Please use a descriptive name for the form so it is immediately obvious what your form is supposed to do.  

      CSRF protection
      Inside the form i.e. between <form> and </form>, please insert the following jade template code

      include ../components/csrf

      Validation
        Server side validation
        Basic server side validation occurs for all built-in forms.  Validation is established through middleware (system.validateForm).  This middleware takes the handy designated form name as an argument (e.g. userLogin or passReset).  If a custom validation is required, the function name should be provided as the argument instead (e.g. validateForm(custom_validation_function)).

        The built in validation ensures the following

        Attribute: maxlength
          (input types text, textfield, password, url, email, search, tel).  Input length does not exceed maxlength

        Attribute: required
          Value is not empty or undefined

        Attribute: novalidate
          No validation checks are performed
           
        Type: email
          Input matches pattern <something>@<something>

        Type: url
          Input matches pattern http://<something> or https://<something>

        Type: number
          Input is less than or equal to max
          Input is greater than or equal to min  

      
  
Account Management
  One Time Links
    Creation
    
    Verification