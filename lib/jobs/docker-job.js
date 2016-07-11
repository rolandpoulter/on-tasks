// Copyright 2016, EMC, Inc.

'use strict';

var stream = require('stream');
var di = require('di');
module.exports = dockerJobFactory;

di.annotate(dockerJobFactory, new di.Provide('Job.Docker'));
di.annotate(dockerJobFactory, new di.Inject(
    'Job.Base',
    'Util',
    'Logger',
    'Assert',
    // 'Promise',
    'Services.Waterline',
    'Docker'
));

function dockerJobFactory(
    BaseJob,
    util,
    Logger,
    assert,
    // Promise,
    waterline,
    Docker
) {
    var logger = Logger.initialize(dockerJobFactory);

    function DockerJob(options, context, taskId) {
        BaseJob.call(this, logger, options, context, taskId);
        assert.string(this.context.target);
        this.nodeId = this.context.target;
    }
    util.inherits(DockerJob, BaseJob);

    DockerJob.prototype._run = function run() {
        var self = this;

        return waterline.lookups.findOneByTerm(self.nodeId)
            .then(function (lookup) {
              console.log('GOT HERE', arguments);
              sendDockerCommand(null, lookup)
            })
            .catch(function (err) {
              sendDockerCommand(err);
            });

        function sendDockerCommand(err, lookup) {
            console.log('sendDockerCommand', new Error().stack, err, lookup);
            var dockerOptions = {
                protocol: self.options.protocol || 'http',
                host: self.options.host || '127.0.0.1',
                port: self.options.port || 2375,
                ca: self.options.ca || null,
                cert: self.options.cert || null,
                key: self.options.key || null
            };

            if (self.nodeId && lookup) {
              dockerOptions.host = lookup.ipAddress;
            }

            assert.string(dockerOptions.host);

            var docker = new Docker(dockerOptions),
                api = createDockerAPI(docker, logger);

            Promise.all(self.options.exec.map(dockerCall))
                .then(function () {
                    self._done();
                })
                .catch(function (err) {
                    self._done(err);
                });


            function dockerCall(call) {
                return new Promise(function (resolve, reject) {
                    var args = call.args || [];

                    args.push(function(err) {
                        logger.debug(call.method + ': DONE');
                        if (err) { return reject(err); }
                        if (Array.isArray(call.then)) {
                            logger.debug('THEN ' + util.inspect(call.then));
                            return Promise.all(call.then.map(dockerCall))
                                .then(resolve)
                                .catch(reject);
                        }
                        resolve();
                    });

                    logger.debug(call.method + ': ' + util.inspect(args));
                    api[call.method].apply(docker, args);
                });
            }
        }
    };

    return DockerJob;
}

function createDockerAPI(docker, logger) {
  return {
    attach: function(id, opts, cb) { docker.getContainer(id).attach(opts, cb); },
    create: function(opts, cb) { docker.createContainer(opts, cb); },
    inspect: function(id, opts, cb) { docker.getContainer(id).inspect(opts, cb); },
    kill: function(id, opts, cb) { docker.getContainer(id).kill(opts, cb); },
    list: function(cb) { docker.listContainers(cb); },
    logs: function(id, opts, cb) { docker.getContainer(id).logs(opts, cb); },
    pull: function(image, opts, cb) {
        docker.pull(image, opts, function (err, stream) {
            console.log('Pulling:', image, err);
            if (err) { return cb(err); }
            docker.modem.followProgress(stream, onFinished, onProgress);
            function onFinished(err, output) {
                console.log('Pulled:', image, err, output);
                cb(err, output);
            }
            function onProgress(event) {
                console.log('Pull Progress:', event);
            }
        });
    },
    remove: function(id, opts, cb) { docker.getContainer(id).remove(opts, cb); },
    restart: function(id, opts, cb) { docker.getContainer(id).restart(opts, cb); },
    run: function(image, opts, cb) {
        opts.create = opts.create || {};
        opts.create.Image = image;
        docker.createContainer(opts.create, function(err, container) {
            console.log('Created Container:', err, container);
            if (err) { return cb(err); }
            container.start(opts.start, function(err, data) {
                console.log('Started Container:', err, data);
                return cb(err, data, container);
            });
        });
    },
    start: function(id, opts, cb) { docker.getContainer(id).start(opts, cb); },
    stop: function(id, opts, cb) { docker.getContainer(id).stop(opts, cb); }
    // TODO add image and volume commands
  };
}
