var mongoose = require('mongoose'),
    feeds = mongoose.model('feeds'),
    items = mongoose.model('items'),
    url = 'http://localhost';

module.exports = function(app) {

    app.get('/', function(req, res) {
        res.render('index');
    });
    app.get('/list', function(req, res) {
        feeds.find(function(err, feeds) {
            feeds = feeds.map(function(f) {
                f = f.toObject();
                f.items = url + '/items/' + f._id;
                f.fetch = url + '/fetch/' + f._id;
                return f;
            });
            res.json({
                admin: url + '/admin',
                items: url + '/items',
                feeds: feeds
            });
        });
    });
    app.get('/add', function(req, res) {
        feeds.add(req.query.url, function(err, feed) {
            res.json(err || {
                home: url,
                feed: feed
            });
        });
    });
    app.get('/fetch/:id', function(req, res) {
        feeds.findById(req.params.id, function(err, f) {
            f.fetch(function(err, items) {
                res.json({
                    home: url,
                    feed: f,
                    items: items
                });
            });
        });
    });
    app.get('/items/:id?', function(req, res, next) {
        var id = req.params.id;
        items.find(id ? { feed: id } : undefined)
            .sort('date')
            .exec(function(err, items) {
                if (err) return next(err);

                items = items.map(function(it) {
                    it = it.toObject();
                    it.unread = url + '/item/' + it._id + '/unread';
                    return it;
                });
                res.json({
                    home: url,
                    count: items.length,
                    all_read: url,
                    all_unread: url + '/items',
                    items: items
                });
            });
    });
    app.get('/item/:id/unread', function(req, res, next) {
        items.findById(req.params.id, function(err, item) {
            item.unread(function(err, item) {
                if (err) return next(err);
                res.json({
                    home: url,
                    message: 'item was marked as ' + (item.read ? 'read' : 'unread'),
                    item: item
                });
            });
        });
    });

};