(function() {
    'use strict';

    var _ = Stapes._;

    _.Module.prototype.toJSON = function() {
        return this.getAll();
    };
    _.Module.prototype.clean = function() {
        this.remove(function() {
            return true;
        });
        this.emit('clean');
        return this;
    };

    window.Model = Stapes.subclass({
        constructor: function(data, collection) {
            this.collection = collection;
            data = data ? this.parse(data) : {};
            this._id = data._id || '';
            this.set(data);
        },
        fetch: function() {
            rest.get(this.url + this._id, {}, this.callback, this);
        },
        save: function() {
            return rest[this._id ? 'put' : 'post'](this.url + this._id, this.toJSON(), this.callback, this);
        },
        saveAs: function() {
            var ret = this.collection.add(this.toJSON());
            this.clean();
            return ret;
        },
        delete: function() {
            if (!this._id)
                this.emit('delete');

            rest.delete(this.url + this._id, {}, function() {
                this.emit('delete');
            }, this);
        },
        callback: function(res) {
            res = this.parse(res);
            if (!this._id) {
                this._id = res._id;
                if (this.collection)
                    this.collection.move(this, this._id);
            }
            this.set(res);
        },
        parse: function(res) {
            return res;
        }
    });

    window.Collection = Stapes.subclass({
        model: Model,
        constructor: function(arr, model) {
            this.model = model || this.model;
            this.url = this.url || this.model.prototype.url;
            this.push(arr);
        },
        add: function(o) {
            return this.push(o).save();
        },
        move: function(model) {
            this.remove(model.id);
            this.push(model);
        },
        push: function(model, silent) {
            if (_.typeOf(model) === 'array') {
                for (var i = 0, l = model.length; i < l; i++) {
                    this.push(model[i], silent);
                }
                return this;
            }

            if (this.has(model._id))
                return this.get(model._id).set(model);

            model = (model instanceof Model) ? model : new this.model(model);
            model.collection = this;
            model.on('delete', function() {
                this.remove(model._id);
            }, this);

            this.set(model._id || _.makeUuid(), model, silent);

            return model;
        },
        get: function(key) {
            if (!key)
                return this.getAllAsArray();

            return _.Module.prototype.get.apply(this, arguments);
        },
        fetch: function(data) {
            rest.get(this.url, data, function(res) {
                this.push(res);
            }, this);
        },
        toJSON: function() {
            return this.getAllAsArray();
        }
    });

    window.View = Stapes.subclass({
        constructor: function(el, data, render) {
            this.el = $(el || this.el);
            this.data = _.extend({}, this.data, data);
            this.data.view = this;

            if (false !== render)
                this.render();
        },
        render: function() {
            this.binding = rivets.bind(this.el, this.data);
        }
    });

    window.Template = View.subclass({
        constructor: function(template, data, render) {
            this.template = template || this.template;
            View.call(this, null, data, !!render);
        },
        render: function(fn) {
            if (!this.template)
                return console.error('No template', this);

            var that = this;
            dust.render(this.template, {}, function(err, out) {
                if (err) return console.error('ERROR', err);

                that.el = $('<div />').html(out).contents().first();
                that.binding = rivets.bind(that.el, that.data);
                that.emit('bind');
                if (fn) fn.apply(that);
            });
        }
    });

})();