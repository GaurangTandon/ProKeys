We **must** prevent uploads like v3.1.2 with careless, silly bugs. Here's a list of things which MUST be tested before every release:

1. **Snippet execution:** - both through hotkey and context menus  
2. **Mathomania** - parentheses, exponents
3. **Auto-Inserts**  
4. **Snippet list display** - through the issues#153 `.txt` file. It must exactly that display and executed snippet result - in both snippets and textareas - as it lists inside itself.

And on ALL these sites:
1. Gmail - Compose window, reply window - very frequently used, must support  
2. stackoverflow.com/questions/ask - textareas  
3. http://ckeditor.com/ - for iframes
