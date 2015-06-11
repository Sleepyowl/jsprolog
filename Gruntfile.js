module.exports = function (grunt) {
    
    // TODO: add a task to compile modules to a single file    

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jasmine_node: {
            options: {
                forceExit: true,                
            },
            all: []
        },
        execute: {
            convertToAMD: {
                options: {
                    args: ['-convert', 'src', 'build']
                },
                src: "node_modules/requirejs/bin/r.js"
            }
        },
        requirejs: {
            compile: {
                options: {
                    baseUrl: 'build',
                    out: "jsprolog.js",
                    name: "jsprolog",                    
                }
            },
            compileDev: {
                options: {
                    baseUrl: 'build',
                    out: "jsprolog.developer.js",
                    name: "jsprolog",                    
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-jasmine-node');
    grunt.loadNpmTasks('grunt-contrib-requirejs');
    grunt.loadNpmTasks('grunt-execute');
    grunt.registerTask('default', ["jasmine_node", "execute:convertToAMD", 'requirejs']);
};
