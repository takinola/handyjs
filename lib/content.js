/*
 * Functionality to define and manage content
 */

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
var redis_cache = cache_manager.caching({store: redis_store, db: 2});
 
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
      name: {type: 'VARCHAR', size: 100, null: false},
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
 * NOTE: Need to default parameter deleted to false in order to give at least one parameter otherwise the save
 * function will terminate (it has a check that prevents saving empty objects with no parameters)
 */
exports.ContentList = ContentList

function ContentList(){
  var init = {
    contenttype: 'contentlist',
    deleted: false
  };
  var schema = {
    tableName: 'contentlist'
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
    contentlist: null
  };

  var content_schema = {
    columns: {
      title:{type: 'VARCHAR', size: 256, null: true},
      body:{type: 'VARCHAR', size: 32767, null: true},
      published:{type: 'BOOL', null: false, default: true},
      rating:{type: 'INT', size: 10, null: true, default: 0},
      contenttype:{type: 'VARCHAR', size: 256, null: false},
      url:{type: 'VARCHAR', size: 2000, null: true},
      creator: {type: 'INT', size: 10, null: false, foreignkey:{name:'fk_user', reference:{table: 'user', column: 'id'}, onupdate: 'CASCADE', ondelete: 'CASCADE'}},
      category: {type: 'INT', size: 10, null: true, foreignkey:{name:'fk_category', reference:{table: 'category', column: 'id'}, onupdate: 'CASCADE', ondelete: 'CASCADE'}},
      contentlist: {type: 'INT', size: 10, null: false, foreignkey:{name:'fk_contentlist', reference:{table: 'contentlist', column: 'id'}, onupdate: 'CASCADE', ondelete: 'CASCADE'}}
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
  var that = {};
  that.url = this.url;  // to enable check to see if url was modified whilst making unique
  
  var asyncFn = [
    _ensureContentHasContentListEntry.bind(this),
    _saveContent.bind(this),
    _recordUrlAlias.bind(this),
    _updateUrlIfNeeded.bind(this, that),
    _updateSystemVariable.bind(this),
    _invalidateCache.bind(this)
  ];
  
  async.series(asyncFn, function(err, result){
    return callback(err, result);
  });
  
  function _ensureContentHasContentListEntry(asyncCallback){
    // if contentlist parameter is set, end processing
    if(this.contentlist){return asyncCallback(null);}
    
    // create and save new contentlist entry
    var newContentList = new ContentList();
    newContentList.save((function(err){
      if(err){return asyncCallback(err);}
      this.contentlist = newContentList.id;
      return asyncCallback(null);
    }).bind(this));
  }
  
  function _saveContent(asyncCallback){
    system.genericSave.bind(this, asyncCallback)();
  }
  
  // create and record clean url alias
  function _recordUrlAlias(asyncCallback){
    /* This should call a function system.recordUrlAlias which will generate an alias, if required,
     * check the alias is unique (modify it, if not), record the alias to database
     */ 
    
    // create alias, if not provided
    var beginPath = '/' + this.contenttype + '/';
    // check if the url already starts with '/contenttype/'
    this.url = this.url || '';
    var flag = this.url.toLowerCase().indexOf(beginPath.toLowerCase());

    if(flag <0){
      this.url = (this.url !== '') ? beginPath + this.url : beginPath + encodeURIComponent(this.title);
    }

    // change space encoding from '%20' to '-'
    this.url = this.url.replace(/%20/g, '-');
    // remove double encoding ie space -> %20 -> + -> %2B
    //this.url = this.url.replace(/%2B/g, '+');
    
    system.recordUrlAlias([this], function(err){
      return asyncCallback(err);
    });
  }
  
  // this function resaves the content if the url alias is modified for uniquenes by function _recordUrlAlias
  function _updateUrlIfNeeded(oldValue, asyncCallback){
    if(oldValue.url !== this.url){return _saveContent.bind(this, asyncCallback)();}
    return asyncCallback(null);
  }
  
  function _updateSystemVariable(asyncCallback){
    // if saving categories, update the memory as well
    if(this.schema.tableName === 'category'){
      var categoryList = system.systemVariable.getConfig('categoryList');
      categoryList[this.id] = {name: this.name, parent: this.parent};
      system.systemVariable.updateConfig({categoryList: categoryList}, function(err){
        return asyncCallback(err);
      });       
    } else {
      return asyncCallback(null);
    }
  }
  
  function _invalidateCache(asyncCallback){
    var cacheKey = this.contenttype + '_' + this.id;
    redis_cache.del(cacheKey, function(err){
      asyncCallback(err);
    });
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
  var cacheKey = this.contenttype + '_' + id;

  redis_cache.wrap(cacheKey, (function(clbk){
    system.genericLoad.bind(this, id, type, clbk)();
  }).bind(this), (function(err, cacheResult){
    this.cloneObject(cacheResult);  // populate the content with retrieved values
    return callback(err, this);
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
  var pool = system.systemVariable.get('pool');
  pool.getConnection((function(err, connection){
    if(err){return callback(err); }
    var tableName = mysql.escapeId(type.toLowerCase());
    var tableNameCreator = mysql.escapeId((type.concat('.creator').toLowerCase()));
    var tableNameDeleted = mysql.escapeId((type.concat('.deleted').toLowerCase()));
    var tableNameCreateDate = mysql.escapeId((type.concat('.createdate').toLowerCase()));
    var query = 'SELECT * FROM ' + tableName + ' JOIN user WHERE ' + tableNameCreator + ' = user.id AND published = TRUE AND ' + tableNameDeleted + ' = FALSE AND contentlist = ' + this.contentlist + ' ORDER BY ' + tableNameCreateDate;
    connection.query(query, function(err, results){
      connection.release();
      if(err){return callback(err);}
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

  //var newContent = new exports[type.substr(0,1).toUpperCase() + type.substr(1).toLowerCase()];

  switch(type.toLowerCase()){
    case 'category':
      newContent.parent = seed.parentcategory === 'nocategoryselected' ? null : parseInt(seed.parentcategory);
      // ensure parent value is a number
      newContent.parent = typeof newContent.parent !== 'number' ? null : newContent.parent;
      newContent.name = seed.newCategoryName;
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
      break;
    case 'comment':
      newContent.title = seed.body.substr(0,20);
      newContent.body = seed.body;
      // maintain default published status if no published information is provided
      newContent.published = (seed.published === true);
      newContent.rating = seed.rating || null;
      newContent.creator = seed.creator;
      newContent.category = seed.category;
      newContent.contentlist = seed.contentlist || null;  // set to value of contentlist, if provided
      newContent.url = seed.url;
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
      var categoryList = system.systemVariable.getConfig('categoryList');
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
        smc.content[name] = {};
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
        query += ' ' + mysql.escapeId(key) + ' = ' + connection.escape(val) + ' AND';
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
 * Submit sitemap to search engines
 * This function is meant to be run as a cron task therefore the format of the callback is 
 * callback(null, err, result)
 * 
 * @api public
 */
exports.submitXmlSitemap = submitXmlSitemap;

function submitXmlSitemap(req, res, callback){
  var returnMessage; // this is the status message that will be returned
  console.log('starting sitemap submission');
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
  
  var sitemapLocation = encodeURIComponent(req.protocol + '://' + req.host + '/sitemap.xml');
  
  var asyncFn = [];
  searchEngines.forEach(function(engine){
    asyncFn.push(
      function(asyncCallback){
        console.log('calling: ' + engine.hostname + engine.path + sitemapLocation);
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
    });
    return callback(null, message);
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

function getCategorySelectOptions(defaultObj, type){
  defaultObj = defaultObj || {id: null, parent: null};
  type = type || 'parent'; // selects type of default option.  'parent' means the parent category is chosen as default i.e. when editing a category entry. 'self' means the category itself is set as default i.e. when editing content that has a category
  var categoryList = system.systemVariable.getConfig('categoryList');
  var arrangedCategoryList = _arrangeCategoryByParent(categoryList);
  var categorySelectOptions = _getSelectOptions(arrangedCategoryList, defaultObj, type);
  return categorySelectOptions;
}

/*
 * create options for category select form
 * also select default if provided
 */
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
   */
  
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
  
  return finalResult;
}


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