var mongoose = require('mongoose'),
    Types = mongoose.Schema.Types,
    parser = require('rssparser'),
    async = require('async');

var schema = new mongoose.Schema({
    feed: { type: Types.ObjectId, ref: 'feeds' },
    title: { type: String, unique: true },
    url: String,
    date: Date,
    read: { type: Boolean, default: false }
});

schema.methods.unread = function(cb) {
    this.read = !this.read;
    this.save(cb);
};

schema.statics.import = function(feed, items, cb) {
    var Item = this;
    async.map(items, function(it, cb) {
        var item = new Item({
            feed: feed,
            title: it.title,
            url: it.url,
            date: it.published_at
        });
        item.save(function(err) {
            if (err)
                return cb(null, 'exists or error: ' + err);
            cb(null, 'item added');
        });
    }, cb);
};
schema.statics.next = function(category, cb) { cb('not implemented yet'); };

var model = module.exports = mongoose.model('items', schema);

model.resors = {
    allow: [ 'get', 'post', 'put', 'delete' ]
};