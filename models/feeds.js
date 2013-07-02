var mongoose = require('mongoose'),
    Types = mongoose.Schema.Types,
    parser = require('rssparser'),
    async = require('async');

var schema = new mongoose.Schema({
    title: String,
    feed: { type: String, unique: true },
    url: String,
    last_updated: Date,
    enabled: { type: Boolean, default: true },
    category: String
});


schema.methods.toString = function() {
    return this.title;
};
schema.methods.fetch = function(cb) {
    if (!this.enabled)
        cb('cannot fetch disabled feeds.');

    var feed = this,
        items = mongoose.model('items');

    parser.parseURL(this.feed, {}, function(err, out){
        if (err) return cb(err);

        items.import(feed, out.items, function(err) {
            if (err) return cb(err);
            cb(null, out.items);
        });
    });
};

schema.statics.add = function(url, cb) {
    var Feed = this,
        items = mongoose.model('items');

    parser.parseURL(url, {}, function(err, out){
        if (err) return cb(err);

        var feed = new Feed({
            title: out.title,
            feed: url,
            url: out.url
        });
        feed.save(function(err, feed) {
            if (err) return cb(err);

            items.import(feed, out.items, function(err) {
                if (err) return cb(err);
                cb(null, feed);
            });
        });
    });
};
schema.statics.importOPML = function(file, cb) {
    cb('not implemented yet');
};

var model = module.exports = mongoose.model('feeds', schema);

model.resors = {
    allow: [ 'get', 'post', 'put', 'delete' ]
};