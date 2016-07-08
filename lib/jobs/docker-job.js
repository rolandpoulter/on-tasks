// Copyright 2016, EMC, Inc.

'use strict';

var stream = require('stream');
var di = require('di');
module.exports = sshJobFactory;

di.annotate(sshJobFactory, new di.Provide('Job.Docker'));
di.annotate(sshJobFactory, new di.Inject(
    'Job.Base',
    'Util',
    'Logger',
    'Assert',
    'Promise',
    'Services.Waterline',
    'Docker'
));

function sshJobFactory(
    BaseJob,
    util,
    Logger,
    assert,
    Promise,
    waterline,
    Docker
) {
    var logger = Logger.initialize(sshJobFactory);

    function DockerJob(options, context, taskId) {
        BaseJob.call(this, logger, options, context, taskId);
        assert.string(this.context.target);
        this.nodeId = this.context.target;
    }
    util.inherits(DockerJob, BaseJob);

    DockerJob.prototype._run = function run() {
        var self = this;

        return waterline.lookups.findOneByTerm(self.nodeId)
            .catch(sendDockerCommand)
            .then(function (lookup) {
              sendDockerCommand(null, lookup)
            });

        function sendDockerCommand(err, lookup) {
            var docker = new Docker({
                protocol: self.options.protocol,
                host: self.nodeId && lookup && lookup.ipAddress || self.options.host,
                port: self.options.port,
                ca: self.options.ca,
                cert: self.options.cert,
                key: self.options.key
            });

            var output = new stream.Writable({
                write: function(chunk, encoding, next) { next(); }
            });

            var api = {
              inspect: function(id, opts, cb) { docker.getContainer(id).inspect(opts, cb); },
              kill: function(id, opts, cb) { docker.getContainer(id).kill(opts, cb); },
              list: function(cb) { docker.listContainers(cb); },
              logs: function(id, opts, cb) { docker.getContainer(id).logs(opts, cb); },
              pull: function(image, opts, cb) { docker.pull(image, opts, cb); },
              remove: function(id, opts, cb) { docker.getContainer(id).remove(opts, cb); },
              restart: function(id, opts, cb) { docker.getContainer(id).restart(opts, cb); },
              run: function(image, opts, cb) {
                  opts = opts || {};
                  docker.run(image, opts.cmd, output, opts.create, opts.start, cb);
              },
              stop: function(id, opts, cb) { docker.getContainer(id).stop(opts, cb); }
            };

            Promise.all(self.options.exec.map(dockerCall))
                .catch(function (err) {
                    self._done(err);
                })
                .then(function () {
                    self._done();
                });

            function dockerCall(call) {
                return new Promise(function (resolve, reject) {
                    var args = call.args || [];

                    args.push(function(err) {
                        if (err) { return reject(err); }
                        resolve();
                    });

                    api[call.method].apply(docker, args);
                });
            }
        }
    };

    return DockerJob;
}
