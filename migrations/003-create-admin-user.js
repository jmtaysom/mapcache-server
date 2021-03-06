var models = require('mapcache-models')
  , Role = models.Role
  , User = models.User;

exports.id = 'create-initial-admin-user';

exports.up = function(done) {
  var password = 'admin';
  Role.getRole('ADMIN_ROLE', function(err, role) {
    if (err) return next(err);

    if (!role) return next(new Error('No ADMIN_ROLE found to attach to ADMIN_USER'));

    var adminUser = {
      active: 'true',
      username: 'admin',
      password: 'admin',
      firstname: 'admin',
      lastname: 'admin',
      roleId: role._id
    };

    User.createUser(adminUser, done);
  });
};

exports.down = function(done) {
  User.getUserByUsername('admin', function(err, user) {
    if (err || !user) return done(err);

    User.deleteUser(user, done);
  });
};
