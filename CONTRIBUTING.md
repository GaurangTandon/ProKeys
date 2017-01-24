**Before uploading your files**  
0. Check all "TODO" comments and for each, resolve it/raise an issue about it and then remove it's comment.  
1. ESLint all the JS files.  
2. Update the version number in options.html and manifest to the latest version number.  
3. Remove/comment `console.log`s from all JS files. Run Replace function to remove all tab chars at the end of lines - `\t+$` 
4. Minify all the files.
5. Update the change log in options.html as well as on [github](https://github.com/GaurangTandon/ProKeys/edit/master/change_log.md)
6. Make sure that the update fixes all the bugs listed for its milestone number.  
7. Make sure that the update fixes concerned bugs listed under "In Progress" on user feedback page.

**Please follow the following conventions:**

1. All class names in HTML must be in small case. Multiple words should be separated by underscore.
2. Snippet parts should be referred to as "name" and "body" respectively.
3. All variables names related to a HTML Node should EITHER have $ at the start of their name OR contain the word "node" (not elm) in their name.
