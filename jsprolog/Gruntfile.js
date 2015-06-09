module.exports = function (grunt) {
    
    // TODO: add a task to compile modules to a single file    

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jasmine_node: {
            options: {
                forceExit: true,
                match: '.',
                matchall: false,
                extensions: 'js',
                specNameMatcher: 'spec'
            },
            all: ['specs/']
        },
    });

    grunt.loadNpmTasks('grunt-jasmine-node');
    grunt.registerTask('default', [ "jasmine_node"]);
};