'use strict';
if (!module.parent) console.error('Please don\'t call me directly.I am just the main app\'s minion.') || process.process.exit(1);

var _ = require('underscore');
var async = require('async');
var path = require('path');

exports.crypt = require('./crypt');
var formage = exports.formage = require('formage');
exports.forms = formage;
var forms = formage.forms;
exports.AdminForm = require('./form').AdminForm;

exports.version = '1.0.1';

/**
 * MongooseAdmin Constructor
 *
 * @api private
 */
function MongooseAdmin(app, root) {
    this.app = app;
    this.root = root;
    this.models = {};
    this.title = "Backoffice";
}





/**
 * Create the admin singleton object
 *
 * @param {Object} app
 * @param {Object} options
 * @param {Object} arg_mongoose
 *
 * @api public
 */
exports.createAdmin = function (app, options, arg_mongoose) {
    module.app = app;
    options = options || {};

    //noinspection JSUnresolvedVariable
    module.mongoose_module = exports.mongoose_module = exports.mongoose_module || module.mongoose_module || arg_mongoose || module.parent.mongoose || module.parent.mongoose_module;
    var root = options.root || '';
    console.log('\x1b[36mMongooseAdmin is listening at path: \x1b[0m %s', root);

    if (!module.mongoose_module) throw new Error("Must have mongoose");
    module.permissions = require('./permissions');
    module.MongooseAdminUser = require('./mongoose_admin_user.js').MongooseAdminUser;
    module.MongooseAdminAudit = require('./mongoose_admin_audit.js').MongooseAdminAudit;
    require('./register_paths').registerPaths(MongooseAdmin, app, '/' + root);
    MongooseAdmin.singleton = new MongooseAdmin(app, '/' + root);
    return MongooseAdmin.singleton;
};


/**
 * Build a full path that can be used in a URL
 *
 * @param {String} path
 */
MongooseAdmin.prototype.buildPath = function (path) {return this.root + path;};


MongooseAdmin.prototype.getAdminTitle = function () {return this.title;};


MongooseAdmin.prototype.setAdminTitle = function (title) {this.title = title;};


/**
 * Push the mongoose-admin express config to the current config
 *
 */
MongooseAdmin.prototype.pushExpressConfig = function () {
    var currentViewsPath = MongooseAdmin.singleton.app.set('views');
    module.app.engine('jade', require('jade').__express);
    module.app.set('views', __dirname + '/views');
    return {'views': currentViewsPath};
};

/**
 * Replace the mongoose-admin express config with the original
 */
MongooseAdmin.prototype.popExpressConfig = function (config) {
    module.app.set('views', config.views);
};


function async_build_model_filters(model, filters, dict) {
    process.nextTick(function () {
        filters.forEach(function (filter, cbk) {
            var filter_options = model.schema.paths[filter].options || {};
            var ref_name = filter_options && filter_options.ref;
            model.collection.distinct(filter, function (err, results) {
                if (!results) {
                    return cbk(err);
                }
                if (results[0] && Array.isArray(results[0])) {
                    results = _.flatten(results);
                }
                if (results.length > 30) {
                    results.splice(5);
                }
                if (ref_name) {
                    exports.mongoose_module.model(ref_name).find()
                        .where('_id').in(results).exec(function (err, refs) {
                            if (refs) {
                                dict.push({
                                    key: filter,
                                    isString: false,
                                    values: refs.map(function (ref) {return {value: ref.id, text: ref.toString()};})
                                });
                            }
                            cbk(err);
                        })
                } else {
                    dict.push({
                        key: filter,
                        values: results.map(function (result) {
                            return {
                                value: result,
                                text: result,
                                isString: filter_options.type === String
                            };
                        })});
                    cbk();
                }
                return null;
            })
        })
    });
}


MongooseAdmin.prototype.registerMongooseModel = function (modelName, model, fields, options) {
    options = options || {};
    options.actions = options.actions || [];
    options.actions.push({value: 'delete', label: 'Delete', func: function (user, ids, callback) {
        //noinspection JSUnresolvedFunction
        async.parallel(_.map(ids, function (id) {
            return function (cbk) {
                forms.checkDependecies(modelName, id, cbk);
            }
        }), function (err, results) {
            if (err) {
                callback(err);
            }
            else {
                var no_dependecies = _.filter(ids, function (result, index) {
                    return results[index].length === 0;
                });
                model.remove({_id: {$in: no_dependecies}}, callback);
            }
        });
    }});
    var filters = [];
    async_build_model_filters(model, options.filters, filters);

    this.models[modelName] = {model: model,
        filters: filters,
        modelName: modelName,
        options: options,
        fields: fields};

    console.log('\x1b[36mMongooseAdmin registered model: \x1b[0m %s', modelName);

    module.permissions.registerModel(modelName);
};

MongooseAdmin.prototype.registerSingleRowModel = function (model, name, options) {
    model.is_single = true;
    this.models[name] = {model: model, options: options || {}, fields: {}, is_single: true, modelName: name};
    module.permissions.registerModel(name);
};


/**
 * Register a new mongoose model/schema with admin
 *
 * @param {Object} model
 * @param {String} name
 * @param {Object} options
 *
 * @api public
 */
MongooseAdmin.prototype.registerModel = function (model, name, options) {
    this.models[name] = {model: model, modelName: name, options: options};
    console.log('\x1b[36mMongooseAdmin registered model: \x1b[0m %s', name);

};


/**
 * Retrieve a list of all registered models
 *
 * @param {Function} callback
 *
 * @api public
 */
MongooseAdmin.prototype.getRegisteredModels = function (user, callback) {
    var models = [];
    var schemas = this.models;
    Object.keys(this.models).forEach(function (model_name) {
        var model_schema = schemas[model_name];
        model_schema.model.is_single = model_schema.is_single;
        if (module.permissions.hasPermissions(user, model.modelName, 'view')) {
            models.push(model_schema);
        }
    });
    callback(null, models);
};


/**
 * Get a single model from the registered list with admin
 *
 * @param {String} model_name
 * @param {Function} callback
 *
 * @api public
 */
MongooseAdmin.prototype.getModel = function (model_name, callback) {
    var model_schema = this.models[model_name];
    callback(null, model_schema.model, model_schema.fields, model_schema.options);
};


/**
 * Get the counts of a model
 *
 * @param {String} model_name
 *
 * @api public
 */
MongooseAdmin.prototype.modelCounts = function (model_name, filters, callback) {
    var model_schema = self.models[model_name];
    var model = model_schema.model;
    if (model_schema.is_single) {
        callback(null, 1);
        return;
    }
    filters.filter(function (val) {return model.schema && typeof(val) === 'string'})
        .forEach(function (value, key) {
            var type = model.schema.paths[key].options.type;
            if (type === String) {
                filters[key] = new RegExp(value, 'i');
            } else if (type === Number) {
                filters[key] = Number(value) || undefined;
            } else if (type === Boolean) {
                filters[key] = value === 'true';
            }
        });
    model.count(filters, callback);
};


function mongooseSort(query, sort) {
    var IS_OLD_MONGOOSE = Number(exports.mongoose_module.version.split('.')[0]) < 3;
    if (IS_OLD_MONGOOSE) {
        if (sort.indexOf('-') === 0) {
            query.sort(sort.slice(1), 'descending');
        } else {
            query.sort(sort, 'ascending');
        }
    } else {
        query.sort(sort);
    }
}

/**
 * List a page of documents from a model
 *
 * @param {String} model_name
 * @param {Number} start
 * @param {Number} count
 * @param {Function} callback
 *
 * @api public
 */
MongooseAdmin.prototype.listModelDocuments = function (model_name, start, count, filters, sort, callback) {
    var listFields = this.models[model_name].options.list;
    if (listFields) {
        var model;
        try {
            model = exports.mongoose_module.model(model_name);
        }
        catch (e) {
            model = this.models[model_name].model;
        }
        _.each(filters, function (value, key) {
            if (model.schema && typeof(
                value
                ) === 'string') {
                var type = model.schema.paths[key].options.type;
                if (type === String) {
                    filters[key] = new RegExp(value, 'i');
                }
                else if (type === Number) {
                    filters[key] = Number(value) || undefined;
                }
                else if (type === Boolean) {
                    filters[key] = value === 'true';
                }
            }
        });
        var query = this.models[model_name].model.find(filters);
        var sorts = this.models[model_name].options.order_by || [];
        var populates = this.models[model_name].options.list_populate;
        if (sort) {
            sorts.unshift(sort);
        }
        if (sorts) {
            for (var i = 0; i < sorts.length; i++) {
                mongooseSort(query, sorts[i]);
            }
        }
        if (populates) {
            _.each(populates, function (populate) {
                query.populate(populate);
            });
        }
        query.skip(start).limit(count).execFind(function (err, documents) {
            if (err) {
                console.error('Unable to get documents for model because: ' + err);
                callback(null, []);
            } else {
                var filteredDocuments = [];
                documents.forEach(function (document) {
                    var d = {};
                    d['_id'] = document['_id'];
                    listFields.forEach(function (listField) {
                        d[listField] = typeof(
                            document[listField]
                            ) === 'function' ? document[listField]() : document.get(listField);
                    });
                    filteredDocuments.push(d);
                });

                callback(null, filteredDocuments);
            }
        });
    }
    else {
        callback(null, []);
    }
};


/**
 * Retrieve a single document
 *
 * @param {String} model_name
 * @param {String} documentId
 * @param {Function} callback
 *
 * @api public
 */
MongooseAdmin.prototype.getDocument = function (model_name, documentId, callback) {
    this.models[model_name].model.findById(documentId, callback);
};


/**
 * Create a new document
 *
 * @param {String} model_name
 * @param {Object} params
 * @param {Function} callback
 *
 * @api public
 */
MongooseAdmin.prototype.createDocument = function (req, user, model_name, params, callback) {
    var self = this;
    var model_schema = self.models[model_name];
    var model = this.models[model_name].model;
    var FormType1 = this.models[model_name].options.form || exports.AdminForm;
    if (!module.permissions.hasPermissions(user, model_name, 'create')) {
        return callback('unauthorizaed');
    }
    var form = new FormType1(req, {data: params}, model);
    form.is_valid(function (err, valid) {
        if (err) throw err;
        if (!valid) {
            return callback(form, null);
        }
        form.save(function (err, document) {
            if (err) throw err;
            if (model_schema.options && model_schema.options.post) {
                document = model_schema.options.post(document);
            }
            module.MongooseAdminAudit.logActivity(user, model_schema.modelName, model_name, document._id, 'add', null, function () {
                callback(null, document);
            });
        });
        return null;
    });
    return null;
};


/**
 * Update a document
 *
 * @param {String} model_name
 * @param {String} documentId
 * @param {Object} params
 * @param {Function} callback
 *
 * @api public
 */
MongooseAdmin.prototype.updateDocument = function (req, user, model_name, documentId, params, callback) {
    var model_schema = this.models[model_name];
    var model = model_schema.model;
    if (!module.permissions.hasPermissions(user, model_name, 'update')) {
        return callback('unauthorized');
    }
    var FormType = model_schema.options.form || exports.AdminForm;
    model.findById(documentId, function (err, doc) {
        if (err) throw err;
        var form = new FormType(req, {instance: doc, data: params}, model);
        form.is_valid(function (err, valid) {
            if (err) throw err;
            if (!valid) return callback(form, null);
            form.save(function (err, doc2) {
                if (err) throw err;
                doc2 = model_schema.options && model_schema.options.post && model_schema.options.post(doc2) || doc2;
                module.MongooseAdminAudit.logActivity(user, model_schema.modelName, model_name, doc2._id, 'edit', null, function () {
                    return callback(null, doc2);
                });
            });
            return null;
        });
    });
    return null;
};


/**
 * Delete, remove a document
 *
 * @param {String} user
 * @param {String} model_name
 * @param {String} documentId
 * @param {Function} callback
 *
 * @api public
 */
MongooseAdmin.prototype.deleteDocument = function (user, model_name, documentId, callback) {
    var self = this;
    var model_item = self.models[model_name];
    var model = model_item.model;
    if (module.permissions.hasPermissions(user, model_name, 'delete')) {
        model.findById(documentId, function (err, document) {
            if (err) {
                console.log('Error retrieving document to delete: ' + err);
                callback('Unable to delete');
            } else {
                if (!document) {
                    callback('Document not found');
                } else {
                    forms.unlinkDependencies(model_item.modelName, documentId, function (err) {
                        if (err) {
                            callback('unlink dependencies failed');
                        }
                        else {
                            document.remove();
                            module.MongooseAdminAudit.logActivity(user, model_item.modelName, model_name, documentId, 'del', null, function () {
                                callback(null);
                            });
                        }
                    });
                }
            }
        });
    }
    else {
        callback('unauthorized')
    }
};


MongooseAdmin.prototype.orderDocuments = function (user, model_name, data_dict, callback) {
    var model = this.models[model_name].model;
    if (!module.permissions.hasPermissions(user, model_name, 'order')) {
        return callback('unauthorized');
    }
    var sorting_attr = this.models[model_name].options.sortable;
    if (!sorting_attr) {
        return callback(null);
    }
    model.find().where('_id').in(Object.keys(data)).stream({
        end: callback,
        write: function (doc) {
            doc[sorting_attr] = data_dict[doc.id];
            doc.save(console.log);
        }
    });
    return null;
};


MongooseAdmin.prototype.actionDocuments = function (user, model_name, aID, data, callback) {
    if (!module.permissions.hasPermissions(user, model_name, 'action')) {
        return callback('unauthorized');
    }
    var action = this.models[model_name].options.actions.filter(function (a) {return a.value === aID;})[0];
    if (!action) {
        return callback('no action');
    }
    return action.func(user, data.ids, callback);
};



/**
 * Deserialize a user from a session store object
 *
 * @param {Object} sessionStore
 *
 * @api private
 */
MongooseAdmin.userFromSessionStore = function (sessionStore) {
    return module.MongooseAdminUser.fromSessionStore(sessionStore);
};

/**
 * Create an admin user account
 *
 * @param {String} username
 * @param {String} password
 *
 * @api public
 */
MongooseAdmin.prototype.ensureUserExists = function (username, password) {
    module.MongooseAdminUser.ensureExists(username, password, function (err, adminUser) {
        if (!err) {
            console.log('Created admin user: ' + adminUser.fields.username);
        }
    });
};

/**
 * Log in as a user
 *
 * @param {String} username
 * @param {String} password
 * @param {Function} callback
 *
 * @api public
 */
MongooseAdmin.prototype.login = function (username, password, callback) {
    module.MongooseAdminUser.getByUsernamePassword(username, password, function (err, adminUser) {
        callback(err, adminUser);
    });
};


exports.loadApi = require('./form').loadApi;
