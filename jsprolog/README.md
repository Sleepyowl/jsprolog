# jsprolog

### What is it?

It's a simple Prolog interpreter written with javascript (ECMAScript5). I've adapted it from [Jan's javascript Prolog interpreter](http://ioctl.org/logic/prolog-latest)).

### What it can do
It can solve simple stuff, but it's functionality is severely limited: it has no support for operators (neither user-defined, nor builtin) and only 3 builins: fail/0, call/1 and cut/0.
Also while it tries to be smart with recursive predicates in tail position, memory still leaks somewhere.

Main derivation function returns an iterator of sorts -- a function that returns a function to perform a next step or null. It makes possible, for instance, to execute derivation process by chunks in a `window.setTimeout()` callback.
