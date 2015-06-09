# jsprolog

A simple Prolog interpreter written with javascript.
Adapted from Jan's Prolog interpreter (See [http://ioctl.org/logic/prolog-latest](http://ioctl.org/logic/prolog-latest)).

### What it can do
It can solve simple stuff, but it's functionality is severely limited: it has no support for operators and only 3 builins: fail/0, call/1 and cut/0.
Also while it tries to be smart with tail-recursive predicates, memory still leaks somewhere.


