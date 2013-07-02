// utils
var _ = {
    slice: [].slice,
    extend: function(a) {
        var args = _.slice.call(arguments);
        a = args.shift();
        args.forEach(function(b) {
            var k;
            for (k in b)
                a[k] = b[k];
        });
        return a;
    },
    inherits: function(a, b) {
        a || (a = function() {
            b.apply(this, arguments);
        });
        _.extend(a.prototype, b.prototype);

        a.prototype.constructor = a;
        a.parent = b;
        return a;
    }
};

// Events
var Events = {
    emit: function(e, data) {
        if (this._events && this._events[e]) {
            var self = this;
            this._events[e].forEach(function(cb) {
                cb.call(self, data);
            });
        }
        return this;
    },
    on: function(e, cb) {
        var dict = this._events;
        dict || (dict = this._events = {});
        e.split(' ').forEach(function(e) {
            if (!dict[e])
                dict[e] = [cb];
            else
                dict[e].push(cb);
        });
        return this;
    },
    off: function(e, cb) {
        if (!cb)
            this._events[e] = [];
        else
            this._events[e].splice(this._events[e].indexOf(cb), 1);
        return this;
    }
};


// Setter
var Setter = _.extend({
    get: function(k) {
        return this._attr[k];
    },
    set: function(k, v) {
        this._attr || (this._attr = {});
        if (arguments.length == 1) {
            for (v in k)
                this.set(v, k[v]);
            return;
        }
        this._attr[k] = v;
        this.emit('change', k)
            .emit('change:'+k, v);
        return this;
    },
    remove: function(k) {
        var v = this._attr[k];
        delete this._attr[k];
        this.emit('remove', k)
            .emit('remove:'+k, v);
        return this;
    }
}, Events);


// Model
var Model = function(data) {
    this.set(data);
};
_.extend(Model.prototype, Setter);


var model = new Model({
    a: 1,
    b: 2,
    c: 2,
    d: 1
});
//model.remove('d');
var k;
for (k in model._attr) {
    if (model._attr[k] == 2)
        model.remove(k);
}


// Animals
var Animal = _.inherits(0, Model);
Animal.prototype.age = function() {
    var b = this.get('birth_year');
    return !b ? null : (new Date).getFullYear() - b;
};

var Bear = function(name) {
    Bear.parent.apply(this);
    this.on('change:name', function(name) {
        console.log('bear new name is', name);
    });
    this.set('name', name);
};
_.inherits(Bear, Animal);
Bear.prototype.getName = function() {
    return this.get('name');
};


var bear = new Bear('teddy');

console.log([bear, bear.getName()]);