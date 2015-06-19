/*
 * Functionality to define and manage content
 */

'use strict';

var system = require('./system')
  , utility = require('./utility')
  , _ = require('underscore')
  , async = require('async')
  , http = require('http')
  , mysql = require('mysql')
  ;
 
// set up cache manager
var cache_manager = require('cache-manager');
var redis_store = require('./modules/redis_store');

let defaultRedisDb = 1;  // redis db will be modified by environment variables as needed
let defaultRedisPort = 6379;  // default redis port
let defaultRedisHost = 'localhost';  // default redis host

// instruct cache manager not to cache nulls and undefineds.
// should not really need this but it is a workaround for a bug
// in how the "wrap" method works in the cache manager
let isCacheableValue = function(value){
  return value != null && value !== undefined;
}

let redisOptions = {
  store: redis_store,
  host: process.env.REDIS_HOST || defaultRedisHost,
  port: parseInt(process.env.REDIS_PORT || defaultRedisPort),
  db: parseInt(process.env.REDIS_DB || defaultRedisDb),
  isCacheableValue: isCacheableValue,
};

let redis_cache = cache_manager.caching(redisOptions);

// object containing random strings used for secret keys, redis db prefix, etc
const secretStrings = system.secretStrings;
 
// define categories
exports.Category = Category;

function Category(){
  var init = {
    name: null,
    parent: null
  };
  
  var schema = {
    tableName: 'category',
    columns: {
      name: {type: 'VARCHAR', size: 1000, null: false},
      parent: {type: 'INT', size: 10, null: true, foreignkey:{name:'fk_id', reference:{table: 'category', column: 'id'}, onupdate: 'CASCADE', ondelete: 'CASCADE'}}
    }
  };
  
  system.BaseObject.call(this, init, schema);
}

utility.subClass(system.BaseObject, Category);

/*
 * Content List table
 * This table contains an entry for each content created.  It is used to provide relationships between different
 * content records e.g. story(id=4) and comment(id=31) may both reference contentlist(id=20) which would suggest
 * that comment(id=31) is a comment related to story(id=4)
 * NOTE: Need to default parameter "deleted" to false in order to give at least one parameter otherwise the save
 * function will terminate (it has a check that prevents saving empty objects with no parameters)
 * ALSO: Need to figure out how to remove the 'organization' field inherited from BaseObject since it is not needed
 */
exports.ContentList = ContentList

function ContentList(){
  var init = {
    contenttype: 'contentlist',
    deleted: false,
    relatedto: null
  };
  var schema = {
    tableName: 'contentlist',
    columns: {
      type: {type: 'VARCHAR', size: 256, null: true},
      typeid: {type: 'INT', size: 10, null: true},
      relatedto: {type: 'INT', size: 10, null: true},
    }
  };
  system.BaseObject.call(this, init, schema);
}
utility.subClass(system.BaseObject, ContentList);


/*
 * Base content class
 *
 * @param {object} init - initializing properties for the new object instance
 * @param {object} schema - database schema for added properties
 */
exports.Content = Content;

function Content(init, schema){
  // set defaults for init and schema
  init = (init !== undefined && init !== null) ? init : {};
  schema = (schema !== undefined && schema !== null) ? schema : {};
  
  var content_init = {
    title: null,
    body: null,
    published: true,
    rating: null,
    contenttype: null,
    url: null,
    creator: null,
    category: null,
    contentid: null,
    organization: null,
    relatedto: null,
  };

  // Schema Primer
  // contentid: pointer to related entry in contentlist table
  // relatedto: pointer to entry in contentlist table for related content e.g. comment x would have a relatedto pointer to contentlist entry of blog y

  var content_schema = {
    columns: {
      title:{type: 'VARCHAR', size: 512, null: true},
      body:{type: 'VARCHAR', size: 49150, null: true},
      published:{type: 'BOOL', null: false, default: true},
      rating:{type: 'INT', size: 10, null: true, default: 0},
      contenttype:{type: 'VARCHAR', size: 512, null: false},
      url:{type: 'VARCHAR', size: 2000, null: true, index: true},
      creator: {type: 'INT', size: 10, null: false, foreignkey:{name:'fk_user', reference:{table: 'user', column: 'id'}, onupdate: 'CASCADE', ondelete: 'CASCADE'}},
      category: {type: 'INT', size: 10, null: true, foreignkey:{name:'fk_category', reference:{table: 'category', column: 'id'}, onupdate: 'CASCADE', ondelete: 'CASCADE'}},
      contentid: {type: 'INT', size: 10, null: false, foreignkey:{name:'fk_contentid', reference:{table: 'contentlist', column: 'id'}, onupdate: 'CASCADE', ondelete: 'CASCADE'}},
      relatedto: {type: 'INT', size: 10, null: true, foreignkey:{name:'fk_relatedto', reference:{table: 'contentlist', column: 'id'}, onupdate: 'CASCADE', ondelete: 'CASCADE'}},
    },
  };
  
  // include the additional properties and schema
  _.forEach(init, function(val, key){
    content_init[key] = val;
  });
  
  // update schema
  content_schema.tableName = schema.tableName;
  
  _.forEach(schema.columns, function(columnDefinition, columnName){
    content_schema.columns[columnName] = columnDefinition;
  });

  system.BaseObject.call(this, content_init, content_schema);
}

utility.subClass(system.BaseObject, Content);

// set content status to published
Content.prototype.publish = function(){
  this.set('published', true, function(){
     return;
  });
}

// set content status to unpublished
Content.prototype.unpublish = function(){
  this.set('published', false, function(){
    return;
  });
}

// rate content
Content.prototype.rate = function(rating){
  // stop processing if rating is not a number or it is not within the range of 0 - 10
  if(typeof rating !== 'number' || rating > 10 || rating < 0){
    return;
  }
  this.set('rating', rating, function(){
    return;
  });
}


/* 
 * Custom save content object to database is required to ensure all 
 * content objects have respective entries in the contentList table
 *
 * @api public
 */
Content.prototype.save = function(callback){
  _upsertContentListEntry.bind(this)()       // create contentlist entry
  .then(_prepUrl.bind(this))                 // ensure url exists and is unique
  .then(_saveContent.bind(this))             // save the content (with a pointer to the contentlist entry)
  .then(_upsertContentListEntry.bind(this))  // update the contentlist entry again (with a pointer to the content id)
  .then(_invalidateCache.bind(this))         // invalidate the content cache
  .then(_recordUrlAlias.bind(this))          // update systemConfig.alias with pointers from contentlist and content
  .then(_updateSystemVariableCategoryListIfNecessary.bind(this))  // for category content only, update the systemVariable category record
  .then(function(){
    callback(null, this);
  }.bind(this))
  .catch(function(err){
    callback(err);
  });

  function _upsertContentListEntry(){
    return new Promise((function(resolve, reject){
      let contentlist = new ContentList();
      if(this.contentid){ contentlist.id = this.contentid; } // if a contentlist entry exists, then update it
      contentlist.type = this.contenttype;
      contentlist.typeid = this.id || null;  // this.id may not exist at this point;
      contentlist.relatedto = this.relatedto || null; // this.relatedto may not exist

      // save contentlist
      contentlist.save((function(err, savedContentlist){
        contentlist = null;  // free up memory
        if(err){ return reject(err); }
        this.contentid = savedContentlist.id;
        resolve(this);
      }).bind(this));
    }).bind(this));
  }

  // ensures a unique url exists for this content
  function _prepUrl(that){
    return new Promise((function(resolve, reject){
      // get the contentlist id from the argument that
      this.contentlist = that.contentlist;

      // check if url is already specified
      let urlSetFlag = this.url ? true : false;
      // url path for content types in /contenttype/url
      let beginPath = '/' + this.contenttype + '/';
      if(!urlSetFlag){
        this.url = beginPath + encodeURIComponent(this.title);
      }

      // if url was originally set, we need to ensure the path is properly set
      if(!this.url.startsWith(beginPath)){
        this.url = beginPath + this.url;
      }

      // then ensure all spaces are encoded as "-" and not "%20"
      this.url = this.url.replace(/%20/g, '-');

      // convert url to lowercase
      this.url = this.url.toLowerCase();

      // ensure the url is unique.  keep in mind in an update scenario, the url will
      // not be unique since the old record will have the same url
      _makeUrlUnique(this, (function(uniqueUrl){
        this.url = uniqueUrl;
        resolve();
      }).bind(this));
    }).bind(this));
  }

  function _makeUrlUnique(content, ctr, clbk){
    // if this function is not called with an iteration counter, then set ctr to 0
    if(arguments.length === 2){clbk = ctr; ctr = 0}

    // design a suffix to help make the url unique, if required
    let suffix = ctr > 0 ? '_' + ctr : '';
    let potentiallyUniqueUrl = content.url + suffix;

    let uniqueFlag = true;  // assume url is unique
    let alias = system.systemVariable.getConfig('alias');
    _.forEach(alias, function(aliasDetail, contentid){
      if(aliasDetail.url === potentiallyUniqueUrl && aliasDetail.typeid !== content.id){
        uniqueFlag = false;
      }
    });

    if(uniqueFlag){ return clbk(potentiallyUniqueUrl);}

    // url is not unique at this point, so we need to modify and then retry
    ctr++;
    _makeUrlUnique(content, ctr, clbk);
  }

  function _saveContent(){
    return new Promise((function(resolve, reject){
      system.genericSave.bind(this)((function(err, content){
        if(err){ return reject(err); }
        Object.keys(content).map((function(contentKey){
          this[contentKey] = content[contentKey];
        }).bind(this));
        resolve(this);
      }).bind(this));
    }).bind(this));
  }

  function _invalidateCache(){
    // NOTE: All cache keys are stored in the system config variable 'cacheKey'
    // so we need to get all the cache keys that have been used to load this content
    // and delete them from the redis cache and then delete them from the system config variable

    let allCacheKeys = system.systemVariable.getConfig('cacheKey');
    let thisContentCacheKeys = allCacheKeys[this.contenttype + '_' + this.id] || [];

    return new Promise((function(resolve, reject){
      deleteRedisCacheKeys()
      .then(clearConfigCacheRecord.bind(this))
      .then(function(){
        resolve();
      })
      .catch(function(err){
        reject(err);
      })
    }).bind(this));

    function deleteRedisCacheKeys(){
      return Promise.all(thisContentCacheKeys.map(function(key){
        return new Promise(function(_resolve, _reject){
          redis_cache.del(key, function(err){
            if(err){ return _reject(err); }
            _resolve();
          });
        });
      }));
    }

    function clearConfigCacheRecord(){
      return new Promise((function(_resolve, _reject){
        allCacheKeys[this.contenttype + '_' + this.id] = [];
        system.systemVariable.updateConfig({cacheKey: allCacheKeys}, (function(err){
          if(err){ _reject(err); }
          _resolve();
        }).bind(this));
      }).bind(this));
    }
  }

  function _recordUrlAlias(){
    return new Promise((function(resolve, reject){
      let alias = system.systemVariable.getConfig('alias') || {};

      alias[this.contentid] = {
        url: this.url,
        type: this.contenttype,
        typeid: this.id
      };

      system.systemVariable.updateConfig({alias: alias}, (function(err){
        if(err){ return reject(err); }
        resolve(this);
      }).bind(this));
    }).bind(this));
  }

  function _updateSystemVariableCategoryListIfNecessary(){
    return new Promise((function(resolve, reject){
      // if saving categories, update the memory as well
      if(this.schema.tableName === 'category'){
        let categoryList = system.systemVariable.getConfig('categoryList');
        categoryList[this.id] = {name: this.name, parent: this.parent};
        system.systemVariable.updateConfig({categoryList: categoryList}, (function(err){
          if(err){ return reject(err); }
          resolve(this);
        }).bind(this));       
      } else {
        resolve(this);
      }
    }).bind(this));
  }
}


/*
 * Custom load content function is required so as to implement caching
 *
 * @param {integer} id - id of content being loaded
 * @param {string} type - type of identifier i.e. 'id'
 * @api public
 */
Content.prototype.load = function(id, type, callback){
  let cacheKey = secretStrings.redisPrefix + this.contenttype + '_' + id;

  redis_cache.wrap(cacheKey, (function(clbk){
    system.genericLoad.bind(this, id, type, clbk)();
  }).bind(this), (function(err, cacheResult){
    if(err){ return callback(err); }

    this.cloneObject(cacheResult);  // populate the content with retrieved values
    // if the cacheKey used to load the object has never been used, add it to the list of
    // cachekeys for this content
    let allCacheKeys = system.systemVariable.getConfig('cacheKey');
    let thisContentCacheKeys = allCacheKeys[this.contenttype + '_' + this.id] || [];
    if(!_.contains(thisContentCacheKeys, cacheKey)){ thisContentCacheKeys.push(cacheKey); }
    allCacheKeys[this.contenttype + '_' + this.id] = thisContentCacheKeys;

    system.systemVariable.updateConfig({cacheKey: allCacheKeys}, (function(err){
      // if the content has an assigned category, check if the category has been deleted in which case, null it
      if(this.category){
        let categoryList = system.systemVariable.getConfig('categoryList');
        let existingCategoryIds = Object.keys(categoryList).map(function(id){
          return parseInt(id);
        });

        if(!_.contains(existingCategoryIds, this.category)){
          this.category = null;
        }
      }

      return callback(err, this);
    }).bind(this));
  }).bind(this));
}


/*
 * Get content that is related to this one
 * e.g. get all the comments associated with a particular content
 * returns array of related content objects
 *
 * @param {string} type - type of related content to be returned
 * @api public
 */
Content.prototype.getRelatedContent = function(type, callback){
  let table = mysql.escapeId(type.toLowerCase());
  let relationTable = 'contentlist';  // table contentlist has all the content relationships
  let pool = system.systemVariable.get('pool');
  pool.getConnection((function(err, connection){
    if(err){ return callback(err); }

    let query = 'SELECT *' ;
    query += ' FROM ' + table;
    query += ' JOIN user ON user.id = ' + table + '.creator';
    query += ' JOIN ' + relationTable + ' ON ' + relationTable +'.type = ' + table + '.contenttype AND ' + relationTable + '.id = ' + table + '.contentid';
    query += ' WHERE ' + relationTable + '.relatedto = ' + this.contentid;
    query += ' AND ' + table + '.published = TRUE AND ' + table + '.deleted = FALSE';
    query += ' ORDER BY ' + table + '.createdate';

    let options = {
      sql: query,
      nestTables: true
    };

    connection.query(options, function(err, results){
      connection.release();
      if(err){ return callback(err); }
      return callback(null, results);
    });
  }).bind(this));
}

/*
 * Define various default content types
 */


// define story content type
exports.Story = Story;

function Story(){
  var init = {
    contenttype: 'story'
  };
  var schema = {
    tableName: 'story'
  };
  Content.call(this, init, schema);
}

utility.subClass(Content, Story);

// define comment content type
exports.Comment = Comment;

function Comment(){
  var init = {
    contenttype: 'comment',
    published: true
  };
  var schema = {
    tableName: 'comment'
  };
  Content.call(this, init, schema);
}

utility.subClass(Content, Comment);


/*
 * Create new content
 * Wrapper function for Content.save.  Required so that the form processing will not be too unweidly
 *
 * @param {string} type - type of content being created
 * @param {object} seed - parameters of the object to be created.  If the content type is not a standard Handy
 *                        object, the key/values of seed will be transfered without any transformations
 * @api public
 */
exports.createContent = createContent;

function createContent(type, seed, callback){

  // convert parameter 'published' to boolean, if not already
  if(seed.published && typeof seed.published !== 'boolean'){
    seed.published = (seed.published === 'true');
  }

  // create a new content object e.g. Story or Comment
  var newContent = createNewInstance(type);

  switch(type.toLowerCase()){
    case 'category':
      newContent.parent = seed.parentcategory === 'nocategoryselected' ? null : parseInt(seed.parentcategory);
      // ensure parent value is a number
      newContent.parent = typeof newContent.parent !== 'number' ? null : newContent.parent;
      newContent.name = seed.newCategoryName;
      newContent.organization = seed.organization || null;
      break;
    case 'story':
      newContent.title = seed.title;
      newContent.body = seed.body;
      // maintain default published status if no published information is provided
      newContent.published = (seed.published === true);
      newContent.rating = seed.rating || null;
      newContent.creator = seed.creator;
      newContent.category = seed.category;
      newContent.contentlist = null;  // new content does not have any associated contentList record until saved
      newContent.url = seed.url;
      newContent.organization = seed.organization || null;
      break;
    case 'comment':
      newContent.title = seed.body.substr(0,20);
      newContent.body = seed.body;
      // maintain default published status if no published information is provided
      newContent.published = (seed.published === true);
      newContent.rating = seed.rating || null;
      newContent.creator = seed.creator;
      newContent.category = seed.category;
      newContent.relatedto = seed.relatedto || null;  // set to value of relatedto, if provided
      newContent.url = seed.url;
      newContent.organization = seed.organization || null;
      break;
    default:
      _.forEach(seed, function(val, key){
        newContent[key] = val;
      });
      break;
  }
  
  newContent.save((function(err){
    // if this content is a category, save it to configuration
    if(type.toLowerCase() === 'category'){
      let categoryList = system.systemVariable.getConfig('categoryList');
      categoryList[newContent.id] = {name: newContent.name, parent: newContent.parent};
      system.systemVariable.updateConfig({categoryList: categoryList}, (function(err){
        newContent = null;  // free up memory
        return callback(err, this);
      }).bind(newContent));
    } else {
      newContent = null;  // free up memory
      return callback(err, this);      
    }
  }).bind(newContent));

}


/*
 * Create new instance of a content type
 * @param {string} contentType - type of content for which a new instance is required
 * @api public
 *
 */
exports.createNewInstance = createNewInstance;

function createNewInstance(contentType){
  // get list of content types and their constructors
  var contentTypeList = system.systemVariable.getConfig('contentTypeList');

  // match the constructor for the given contentType
  var newInstance = new (utility.caseBlindKeyMatch(contentTypeList, contentType))();
  return newInstance;
}


/*
 * Create new content types
 * This function allows the programatiic expansion of content types i.e. new content types can be defined
 * at run time and they will inherit all the methods and properties of the existing Content object.
 * This ensures content types in future projects do not break when the Content object is upgraded
 *
 * @param {array} contentTypes - Collection of content types to be created.  
 *   Format [{name: contentType name, definition: additional methods and properties of content type}]
 *   format of definition
 *      {
 *       init: <additional properties for the new content type>
 *       schema: <additional database schema definitions for the new content type>
 *      }
 * @api public
 */
exports.createNewContentType = createNewContentType;

function createNewContentType(newContent, callback){
  var asyncFn = {};
  
  newContent.forEach(function(val){
    var type = val.name;
    var definition = val.definition;
    
    asyncFn[type] = function(asyncCallback){
      defineNewContentType(type.toLowerCase(), definition, asyncCallback);
    }
  });
  
  async.series(asyncFn, function(err, constructorObject){
    // create the database tables
    var fnList = [];
    _.forEach(constructorObject, function(constructorName, name){
      fnList.push(
        function(asyncCallback){
          var temp = new constructorName();
          temp.createTable(function(err){
            temp = null;  // free up memory
            return asyncCallback(err);
          });
        }
      );
    });
    
    async.series(fnList, function(err){
      if(err){return callback(err); }
      
      // update system configuration with the new content types
      var contentList = system.systemVariable.getConfig('contentTypeList');
      _.forEach(constructorObject, function(constructorName, name){
        contentList[name] = constructorName;
      });
      
      // update system configuration with new resource permission list
      var rpl = system.systemVariable.getConfig('resourcePermissionList');
      _.forEach(constructorObject, function(constructorName, name){
        rpl.content[name] = [];
      });
      
      // update system configuration with new sitemap config
      var smc = system.systemVariable.getConfig('sitemapConfig');
      _.forEach(constructorObject, function(constructorName, name){
        // initiatilize sitemap settings with defaults
        smc.content[name] = {freq: smc.default.freq, priority: smc.default.priority};
      });
      
      system.systemVariable.updateConfig({contentTypeList: contentList, resourcePermissionList: rpl, sitemapConfig: smc}, function(err_1){
        callback(err_1);
      });
    });
  });
}

/*
 * Define new content types
 * This function allows the programatiic expansion of content types i.e. new content types can be defined
 * at run time and they will inherit all the methods and properties of the existing Content object.
 * This ensures content types in future projects do not break when the Content object is upgraded
 *
 * @param {string} type - name of new content type.  should be unique to avoid clobbering existing content types
 * @param {object} contentDefinition - definition of the new content type. format as follows
 *    {
 *     init: < additional properties for the new content type
 *     schema: <additional database schema definitions for the new content type
 *    }
 * @api public
 */
exports.defineNewContentType = defineNewContentType;

function defineNewContentType(type, contentDefinition, callback){
  // check if content type is specified, end processing if not
  if(typeof type !== 'string'  || type === ''){return new Error('please specify a content type');}
  type = type.toLowerCase();
  
  var init = contentDefinition.init;
  var schema = contentDefinition.schema;
  
  // set contenttype and tableName to type, just in case these were ommitted 
  init.contenttype = type;
  schema.tableName = type;
  
  // really there should be a check to ensure that 'type' is unique and throw an exception if not
  
  function newType(init_n, schema_n){
    this.contenttype = init_n.contenttype;
    this.schema = {};
    this.schema.tableName = schema_n.tableName;

    Content.call(this, init_n, schema_n);
  };
  
  newType.prototype = Object.create(Content.prototype);
  newType.prototype.constructor = newType;
  
  callback(null, newType.bind(null, init, schema));
}


/*
 * Find content based on search criteria
 *
 * @param {string} type - content type
 * @param {object} criteria - search criteria required to match
 * @param {object} options - search options
 * @api public
 */
exports.findContent = findContent;

function findContent(type, criteria, options, callback){
  options.limit.count = options.limit.count || 10;  // default - return only ten items
  options.limit.offset = options.limit.offset || 0;  // default - start from 0
  options.commentCount = options.commentCount || false; // default - do not return count of comments
  var searchContentType = createNewInstance(type);
  var tableName = searchContentType.schema.tableName;
  var pool = system.systemVariable.get('pool');
  pool.getConnection(function(err, connection){
    if(err){return callback(err);}
    var query = 'SELECT * FROM ' + tableName;
    if(criteria){
      query += ' WHERE';
      _.forEach(criteria, function(val, key){
        key = mysql.escapeId(key);
        val = connection.escape(val);
        if(val !== 'NULL'){
          query += ' ' + key + ' = ' + val + ' AND';
        } else {
          query += ' ' + key + ' IS NULL AND';
        }
        
      });
      // remove trailing AND
      query = utility.removeLastCharacter(' AND', query);
    }
    
    query += ' ORDER BY modifydate DESC';
    query += ' LIMIT ' + options.limit.offset + ',' + options.limit.count;
    connection.query(query, function(err, results){
      // if comment count is requested, run query to find the comment count
      if(options.commentCount){
        var asyncFn = [];
        results.forEach(function(row, rowId){
          asyncFn.push(
            function(asyncCallback){
              query = 'SELECT COUNT(*) AS commentCount FROM comment WHERE published = TRUE AND deleted = FALSE AND contentlist = ' + connection.escape(row.contentlist);
              connection.query(query, function(err, countResult){
                results[rowId].commentCount = countResult[0].commentCount;
                asyncCallback(err);
              });
            }
          );
        });
        
        async.parallel(asyncFn, function(err, commentCountResuluts){
          connection.release();
          return callback(err, results);
        });
        
      } else {
        connection.release();
        return callback(err, results); 
      }
    });
  });
}


/*
 * Find content based on alias
 * returns {url: , type: , id: }
 *
 * @param {int} aliasId - aliasId
 * @api public
 */
exports.findContentFromAlias = findContentFromAlias;

function findContentFromAlias(aliasId){
  let errorFlag = false; // identifies any failures in the process and triggers sending an error result
  
  // check if the aliasId provided is truly an integer
  aliasId = parseInt(aliasId);
  errorFlag = _.isNaN(aliasId) ? true : false;

  // get the content refered to by the alias from system config
  let aliasCollection = system.systemVariable.getConfig('alias');
  let alias = aliasCollection[aliasId];
  errorFlag = typeof alias === 'undefined' ? true : false;

  if(errorFlag){
    alias = {url: null, type: null, typeid: null};
  }

  return alias;
}

/*
 * Submit sitemap to search engines
 * This function is meant to be run as a cron task therefore the format of the callback is 
 * callback(null, {err, result})
 * 
 * @api public
 */
exports.submitXmlSitemap = submitXmlSitemap;

function submitXmlSitemap(req, res, id){
  return new Promise(function(resolve, reject){

    var returnMessage; // this is the status message that will be returned

    // check if allowed to submit XML sitemap to search engines
    if(!system.systemVariable.getConfig('sitemapSubmit')){
      return resolve({err: new Error('XML sitemap not submitted by admin request'), id:id, message: 'XML sitemap not submitted by admin request'});
    }

    // set up search engine submission urls
    var google = {
      name: 'Google',
      hostname: 'www.google.com',
      port: 80,
      path: '/webmasters/tools/ping?sitemap='
    };
    
    var bing = {
      name : 'Bing',
      hostname: 'www.bing.com',
      port: 80,
      path: '/ping?sitemap='
    };
    
    var searchEngines = [google, bing];
    
    var sitemapLocation = encodeURIComponent(req.protocol + '://' + req.hostname + '/sitemap.xml');
    
    var asyncFn = [];
    searchEngines.forEach(function(engine){
      asyncFn.push(
        function(asyncCallback){
          engine.path += sitemapLocation;
          http.get(engine, function(resp){
            resp.on('data', function(chunk){
            });
            
            resp.on('end', function(){
              return asyncCallback(null, {engine: engine.name.toLowerCase(), status: resp.statusCode});
            });
          })
          .on('error', function(err){
            return asyncCallback(err);
          });
        }
      );
    });
    
    async.parallel(asyncFn, function(err, results){
      // prep results
      var message = {};
      message.err = err;
      results.forEach(function(val){
        message[val.engine] = 'XML site submission to ' + val.engine + '. Returned status: ' + val.status;
        system.logger.record('info', {req: req, category: 'sitemap', message: message[val.engine]});
      });

      let finalResult = {
        id: id,
        err: err,
        message: err ? 'Error submitting one or more sitemaps' : ' Sitemaps submitted successfully'
      };

      return resolve(finalResult);
    });

  });
}


/*
 * convenience function to prepare category options in format suitable for display
 * returns categories in format
 * [
 *  {value: <val>, selected: true/false, text: 'grandparent -> parent -> child', name: <category name>}, {etc}
 * ]
 *
 * @param {object} defaultObj - default category; used to determine when 'selected' is true (optional)
 * @param {string} type - identifies which type of default match is required.  'self' matches default object, 'parent' matches object's parent (optional)
 * @api public
 */
exports.getCategorySelectOptions = getCategorySelectOptions;

function getCategorySelectOptions(currentCategory, type){
  currentCategory.id = _.isNaN(parseInt(currentCategory.id)) ? null : parseInt(currentCategory.id);
  currentCategory.parent = currentCategory.parent || null;

  type = type || 'parent'; // selects type of default option.  'parent' means the parent category is chosen as default i.e. when editing a category entry. 'self' means the category itself is set as default i.e. when editing content that has a category
  let categoryList = system.systemVariable.getConfig('categoryList');

  // create a tree data structure representing the child relationships
  // this will ensure the categories are sorted and makes it easy to
  // prune a complete branch
  
  // intialize the tree
  let tree = {value: null, selected: false, text: '', name: '', children: [], root: true};
  tree = _getBranches(tree, categoryList);  // get the child branches for this tree node
  tree = _pruneTree(tree, currentCategory, type, tree.text);  // update the information of the tree nodes
  tree = _formatResponse([], tree, currentCategory, type); // prepare the tree in the sorted array format ready to be consumed
  return tree;
}

// recursive function to obtain the child branches for each node of a tree
function _getBranches(node, options){
  _.forEach(options, function(details, id){
    node.value = node.value || 0;
    details.parent = details.parent || 0;
    if(parseInt(details.parent) === parseInt(node.value)){
      node.children.push({
        value: parseInt(id),
        selected: false,
        text: '',
        name: details.name,
        children: []
      });
    }
  });

  // if no children were found for this node, end processing, otherwise continue down the branch
  if(!node.children.length){ return node; }

  node.children = node.children.map(function(childNode){
    return _getBranches(childNode, options);
  });

  return node;
}

// recursive function to update information for each tree node
function _pruneTree(node, targetNode, targetType, nameSuffix){
  // targetType is 'parent', when editing a category (ie the tree is being constructed for the category parent selector)
  // under this scenario, the tree should not include the targetNode and any of its children
  targetType = targetType.toLowerCase();
  nameSuffix = nameSuffix !== '' ? nameSuffix + '&nbsp;' + '&rarr;' + '&nbsp' : '';
  node.text = nameSuffix + node.name;

  let tempChildren = [];
  switch(targetType){
    case 'parent':
      // mark the node selected if targetNode matches one of its children
      node.children.map(function(childNode){
        if(childNode.value === targetNode.id){ node.selected = true; }
      });

      // in the 'parent' scenario, the node.children should not include the targetNode of any of its children
      node.children.map(function(childNode){
        if(childNode.value !== targetNode.id){ tempChildren.push(childNode); }
      });
      node.children = tempChildren;
      break;
    case 'self':
      // mark the node selected if targetNode matches it
      if(targetNode.id === node.value){ node.selected = true; }
      break;
  }

  // if the node has no children, stop processing
  if(!node.children.length){ return node; }

  // prune the child nodes
  node.children = node.children.map(function(childNode){
    return _pruneTree(childNode, targetNode, targetType, node.text)
  });

  return node;
}

// recursive function to convert tree into sorted array of objects
function _formatResponse(response, node, targetNode, targetType){
  let rootSelected, condition1, condition2;
  condition1 = targetNode.parent === null && targetType === 'parent';
  condition2 = targetNode.id === null && targetType === 'self';
  rootSelected = condition1 || condition2 ? true : false;

  if(node.root){ 
    response.push(
      {value: 'nocategoryselected', selected: rootSelected, text: 'No category selected', name: null}
    );
  } else {
    response.push({
      value: node.value,
      selected: node.selected,
      text: node.text,
      name: node.name
    });
  }

  // stop processing if node has no children
  if(!node.children.length){ return response; }

  // format child nodes
  node.children.map(function(childNode){
    response = _formatResponse(response, childNode, targetNode, targetType);
  });

  return response;

}

/*
function getCategorySelectOptions_old(defaultObj, type){
  defaultObj = defaultObj || {id: null, parent: null};
  type = type || 'parent'; // selects type of default option.  'parent' means the parent category is chosen as default i.e. when editing a category entry. 'self' means the category itself is set as default i.e. when editing content that has a category
  var categoryList = system.systemVariable.getConfig('categoryList');
  var arrangedCategoryList = _arrangeCategoryByParent(categoryList);
  var categorySelectOptions = _getSelectOptions(arrangedCategoryList, defaultObj, type);
  return categorySelectOptions;
}
*/
/*
 * create options for category select form
 * also select default if provided
 */
/*
function _getSelectOptions(options, defaultOption, type){
  var categoryOptionList = [];
  var selectFlag = false;
  var temp, id, catName, hierachy;
  
  switch(type.toLowerCase()){
    case 'parent':
      if(defaultOption.parent === null){selectFlag = true;}
      break;
    case 'self':
      if(defaultOption.id === null){selectFlag = true;}
      break;
  }
  
  temp = {value: 'nocategoryselected', selected: selectFlag, text: 'No category selected', name: null};
  categoryOptionList.push(temp);

  options.forEach(function(categoryRow){
    selectFlag = false;
    hierachy = '';
    id = categoryRow[categoryRow.length - 1].id;
    catName = categoryRow[categoryRow.length - 1].name;
    
    switch(type.toLowerCase()){
      case 'parent':
        if(id === defaultOption.parent){selectFlag = true;}
        break;
      case 'self':
        if(id === defaultOption.id){selectFlag = true;}
        break;
    }
    
    categoryRow.forEach(function(category){
      hierachy += category.name + '&nbsp;' + '&rarr;' + '&nbsp;';
    });
    hierachy = hierachy.substr(0, hierachy.length-18);  // remove final &nbsp;&rarr;&nbsp;
    temp = {value: id, selected: selectFlag, text: hierachy, name: catName};
    categoryOptionList.push(temp);
  });
  
  return categoryOptionList;
}
*/
/*
function _arrangeCategoryByParent(list){
  var finalResult;
  var tempResult = [];
  _.forEach(list, function(catDef, catId){
    catId = parseInt(catId);
    var temp = {name: catDef.name, id: catId};
    var parent = _findParent(temp, list);
    parent.push(temp);
    tempResult.push(parent);
  });


  /* tempResult is now in the form [
   *  [[grand-parent], [parent], [child]],
   *  [[parent], [child]]
   * ]
   
  
  // sort the results
  finalResult = _sortCategories(tempResult);

  /* finalResult is now in the form
   * [
   *    [[parent_1],
   *    [[parent_1]], [parent_2]
   *    [[parent_3]],
   *    [[parent_3], [parent_4], [parent_5]]
   * ]
   */
  /*
  return finalResult;
}
*/

/*
function _findParent(child, group, ancestors){
  var parent;
  ancestors = ancestors || [];
  _.forEach(group, function(catDef, catId){
    catId = parseInt(catId);
    if(child.id === catId && catDef.parent !== null){
      parent = {name: group[catDef.parent].name, id: parseInt(catDef.parent)};
      ancestors.unshift(parent)
      return _findParent(parent, group, ancestors);
    }
  });
  
  return ancestors;
}
*/
/*
function _sortCategories(list, sortedList, ctr){
  sortedList = sortedList || [];
  ctr = ctr || 1;
  var temp = [];
  var saveKey = [];  // store the key values to be saved from list
  list.forEach(function(ancestry, key){
    if(ancestry.length === ctr){
      temp.push(ancestry);
    } else {
      saveKey.push(key);
    }
  });
  
  // remove the keys to be processed from list
  var tempList = [];  // will temporarily hold the list
  saveKey.forEach(function(val){
    tempList.push(list[val]);
  });
  list = tempList;
  
  // insert ancestry into proper position on sortedList
  // 1. get the last item in ancestry
  // 2. find a match in the last item of each value on sortedList
  // 3. insert after the match
  
  var youngest;

  temp.forEach(function(ancestry){
    youngest = ancestry.length > 1 ? ancestry[ancestry.length - 2] : ancestry[ancestry.length - 1];  // get the last item in ancestry

    // find a match in the last item on sortedList
    var matchKey = -1;  // this will be the key of the matched item on sortedList

    sortedList.forEach(function(listItem, sortListKey){
      var lastChild = listItem[listItem.length-1];
      if(lastChild.id === youngest.id){
        matchKey = sortListKey;
      }
    });
   
    if(matchKey < 0){
      // no match found, just insert the item into sortedList
      sortedList.push(ancestry);

    } else {
      sortedList.splice(matchKey+1, 0, ancestry);  // insert ancestry right after the matchkey
    }
  });

  // iterate if necessary
  ctr++;
  if(list.length > 0){
    return _sortCategories(list, sortedList, ctr);
  } else {
    return sortedList;
  }
}
*/