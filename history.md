3.0.0 12/17/2015
----
* Fixed bug in routes/forms.js which expected req.params.id to always be a number (which is no longer the case as it is now often the path)
* added support for TinyMCE editor on forms
* added '/internalerror' path
* modified function user.checkUserHasSpecificContentPermission to include the id type of the content so that it is possible to pass urls as well as numeric ids to the function
* fixed bug where hamburger menu in the theme header (only visible on small viewports) does not expand to show items under it

2.0.5 06/28/2015
---
* increased table size for systemconfig
* enabled support for TEXT, BLOB (and related data types) in content type definitions

2.0.4 06/21/2015
---
* minor bug fixes

2.0.2  06/16/2015
---
* fixed foreign key check error that sometimes came up during installation

2.0.1  06/14/2015
---
NOTE: version 2.0.1 is a breaking change from previous versions
* Upgraded to io.js in anticipation of Node.js merge
* Refactored bootstrap code
* Made handy.js OS independent
* Added organization accounts 

1.0.1  10/20/2014
---
* Fixed minor bugs


0.9.3  10/17/2014
---
* ensured each site had a unique session secret, cookie secret and 
* the keys for each content cache are uniquely prefixed

0.9.2  10/11/2014
---
* modified default theme to enable responsiveness in IE8 and below


0.9.1  10/10/2014
---
* robots.txt is now a dynamic file served by nodejs and no longer a static file
* logging for 404 pages now shows the original request 

0.9.0  09/28/2014
---
* introduces theme engine.
NOTE: This is a breaking change for any sites built on earlier versions

0.8.1  09/09/2014
---
* numerous bug fixes

0.8.0  09/01/2014
---
* numerous bug fixes

0.7.0  09/01/2014
---
* beta release