## Change log
<sup>cum to-do list</sup>

**3.1.0** - upcoming
- enable rich text editor for snippet editing - http://nicedit.com/demos.php?demo=2
- highlight placeholders and date/time macros in div.long
- remove timestamp argument from Snip and Folder constructors
- check for duplicate snippets and folders in restore data
- allow some way to show folder timestamp, and no. of snippets/folders inside it. This was the initial design but it spoiled the menu's look: https://s12.postimg.org/f7ef080sd/initial.png
- allow custom import, such as http://www.wordexpander.net/libraries.htm
- sort of green notification on options page when things are updated instead of the alert box
- show `?` mark near things that are likely to confuse users and add a gif photo there
- show the .folderList .selectList with +/- marks to collapse folders, similar to Windows explorer
- .selectList UI decide color
-  if the user accidentally presses the completing parenthesis [')'] out of habit then prokeys should delete a ')' to give ['()'] instead of ['())']
-  highlight matched search phrase in snippet list searching
-  possibility of unlimited revisions, and being able to delete revisions
-  comment the code more properly with precondition and postcondition
- make a way to remove the ctx entry (for insert snippet) in case textbox not isUsableNode

**3.0.0** - upcoming
- made snippet handling OOP, added folder suppet
- logo redesign (thanks [Varun](https://plus.google.com/+VarunSingh000/posts)!)
- removed snippets popup, listing snippets in options page now
- completely redesigned the options page, made responsive till 200% zoom
- fixed: https://github.com/GaurangTandon/ProKeys/issues/3
- first install should open popup box directly and give a greeting message/explaining 3.0.0 changes - done
- fix for certain keycodes not corresponding with their actual key name (in hotkey feature) - fixed for numpad keys, comma and dot;
  unchecked for other OS
- remove case-sensitivity for snippet names
- two digit year date/time macro added
- removed snippet character limits
- changed "Restore" backup to `<input type="file">`
- removed googleBool in setText
- removed delete dialog, replaced with simple window.alert
- added export, import, past revisions buttons in the Snippet page
- added past edited, added, deleted snips restore facility
- removed `bannedElementNodes` String array, which was an attempt to fix issue #3
- create uniformity in naming convention - "name" and "body" only; eliminate "long" and "short"
- create uniformity in css class naming regarding dash and underscore - all switched over to underscore

**2.7.0** - 24/01/2015
- block site access in context menu
- insert snippet from context menu
- enabled for wepaste.com
- fixed issue for iframes not being blocked when parent page is blocked
- button/select/etc. element keydown getting delayed due to prokeys interference - bug fixed
- added tabbing in popup.js for dropdown elements for keyboard accessibility
- added info in Help regarding some sites not working

**2.6.2.1** - 30/10/2015
- fix for single key hotkey not inserting default char when no snippet found

**2.6.2** - 26/10/2015
- fix for multiline bold elements not working
- complete change in setup of snippets/placeholder working (for third time ;) but this one is best and final!)

**2.6.1** - 21/10/2015
- (green) highlight snippet on save, edit to indicate save
- fix for nested placeholder elements

**2.6.0.1** - 18/10/2015
- upload zip of compressed files (reduce size to around 42KB :) )
- refactored popup.js
- fix for snippets+other features not working in Gmail subject line/to field
- fix for placeholder feature not working with element nodes (like `<b>%Order%</b>`)
- debounced both handleKeyPress/Down

**2.6.0** - 06/10/2015
- shorter image names
- minified images - saving nearly 10 KB :)
- new Google Plus logo in About page
- fix for [excessive CPU usage issue](https://github.com/GaurangTandon/ProKeys/issues/3)
- disabled ProKeys for input boxes using ReactJS (they possess `reactid ` in `dataset`)
- refactored detector.js code and others with ESLint
- fix for bug when pressing hotkey while having some text selected
- fix for GitHub, JSFiddle, and other sites which use their own editor (CodeMirror, ace, etc. which interferes with ProKeys)

**2.5.4** - 14/08/2015
- changes in links to the tryit editor in Help section
- fix super ugly bug of "Search" button in popup

**2.5.3** - 06/07/2015
- changes to symbol list order (small to large time duration)
- super bug fix for mathomania!
- quick bug fixes
- refactored popup.js code with bling.js
- help page is now the default page in options.html

**2.5.2** - 05/07/2015
- support for date and time arithmetic, relative as well as independent
- organized symbols, variables into a clean table
- revamped sample snippets shown on first intall
- introduced TryIt editor in Help page

**2.5.1** - 04/07/2015
- fixed a strange issue where on empty snippet was initially shown on install

**2.5.0** - 04/07/2015
- added case-sensitive notice to snippet name
- Nice notifications for install and update
- injecting script automatically on install on most webpages
- sync storage support
- tab key space support removed for input elements
- added "MM" symbol for numeric month in date-time macros
- added “Variables” concept
- improved restore functionality with descriptive error messages
- severe code refactoring to show off on GitHub!

**2.4.6** - 03/05/2015
- removed coloring of counterChecker’s display message (“You have x chars left”)
- fixed bug of textarea height
- removed minimum char limits on snip body and name. Increased body max limit to 2000 characters.
- some code refactoring as well
- made “date-time-macros sample” snippet more helpful
- updated Opera 1.2.0 release

**2.4.5.1** - 15/04/2015
- added support for Evernote beta
- fixed bytes available link in popup html
- removed support for password input
- updated Opera 1.1.0 release

**2.4.5** - 13/04/2015  
- added support for all <input> elements except email/number (because they don’t support caret manipulation)

**2.4.4.1** - 05/04/2015
- removed console.log’s, which were left erroneously, and were used for development purpose
- css changes to popup

**2.4.4** - 04/04/2015
- Facebook Chat, Atlassian (Confluence), Evernote, Mailchimp, Basecamp support added

**2.4.3** - 30/03/2015
- made popup.html and options.html responsive for 200x zoom and 67% zoom both!
- fixed the issue of “none currently” showing in character-counterpart pairs
- fixed site blocker errors
- fixed issue in backup/restore functionality
- added support for SalesForce, Slack

**2.4.2** - 12/03/2015
- fixed silly bugs
- fixed site blocker not working for gmail
- compressed manifest.json
- Opera 1.0.0 release

**2.4.1** - 11/03/2015
- Added option to change hotkey for snippet substitution
- added flattr button

**2.4.0** - 05/03/2015
- date and time macros are here!
- added one sample snippet for date-time macros
- added You have used 1860 bytes out of 102,400 bytes; 11 snippets currently notice

**2.3.0** - 09/11/2014
- Support rich text format (bold, italic, underline)
- options page improvement
- changed snippet viewing to down arrow in popup window
- added helpful sample snippets

**2.2.0** - 01/11/2014
- Fixed the white space collapse problem, by changing the text nodes to span element nodes and completely revamping the functioning of popup.js due to this
- Reduced the line-height of the snippet body in popup window

**2.1.0** - 01/10/2014
- mathomania fixes
- validation format changed

**2.0.0** - 11/09/2014
- Mathomania (type and do math)
- Sync storage
- Options page responsive (for smaller screens)
- print a list of snippets/settings
- backup and restore of settings/snippets
- accidental shift+space produces space and not snippet or error
- added window.onerror

  changes preceding this version are just too minor (and bad)
  to be shown; 

**1.0.0** - 25/June/2014
- ProKeys released
