## Change log

**This Change log has been deprecated since version 3.4.\*. Please head over to [Releases](https://github.com/GaurangTandon/ProKeys/releases) to read the latest changes.**

Helps organize exactly what things happened in which version.

---

**3.3.1** - 25/Jul/2018

-   embed snippets support
-   more robust data restore functionality (ignore unknown props/set to default known props if absent)
-   fix regressions of time function not working and of auto-insert mis-wrapping in whitespace
-   fix regression snippet insertion dead through both hotkey and ctx

**3.2.1** - 21/Jul/2018

-   regression of data restore missing property

**3.2.0** - 20/Jul/2018

-   Snippet expansion inside the address bar (omnibox) is now supported.
-   Added a new snippet macro to insert the current browser URL (or parts of it).
-   Added a clone button that lets you duplicate a snippet or a folder.
-   Pressing an auto-insert with some text selected now wraps the selection inside of it.
-   Using auto-inserts no longer messes up text wrap/formatting in Gmail (and other rich text editors).
-   Auto-inserts are no longer inserted for specific patterns like :-(

**3.1.3** - 17/Mar/2017

-   NodeList prorotype modification now works across iframes - by attaching props to them individually (see [SO](http://stackoverflow.com/questions/42825990/extending-prototype-of-dom-elements-inside-iframes) question)
-   Hence the bug for Evernote, Salesforce, Lithium, and all other iframe elements is fixed

**3.1.2** - 15/Mar/2017

-   Links added by user without any protocol get "http://" prepended by default (as Chrome expects all links to have protocols).
-   Bold and italics now retain tag used by user.
-   Links are now properly displayed in textarea.
-   Nice formatted display of lists, blockquotes, and `<pre>` blocks in snippet list.
-   Further significant improvement to rich text usage (#153)

**3.1.1** - 06/Mar/2017

-   Added FAQ section and Sync troubleshooting section in Help page
-   Added survey form for uninstalls
-   Added significant support for rich text usage (YAY!)
-   Console.log error in webpages after update.
-   made export/backup popup concise
-   added `debounce` to search field, window resize handler
-   searching ignores tags that might overlap with matching text
-   other minor issues

**3.1.0** - 13/Feb/2017

-   Added completely new rich text editor (YAY!) in snippets page.
-   Compressed all images to save 50KB!
-   Bug fixed: storage bytes (under Snippets heading) were shown as "906.0B" instead of "906B"
-   designed better the Help page (cleaner font, bullets, more colors)
-   redesigned blocked sites display
-   fixed auto-insert display code
-   better handling duplicate snippets and folders in restore data (ASSUMPTION: the input data for restore has no duplicates in itself) by offering, in case of duplicate data, to keep either both imported and existing snippets or one of them. Also, can merge duplicate folder's contents.
-   expansion/contraction of folders in `.selectList`
-   allow option to match snippet by whole word in Settings (separated by delimiter - custom list user editable)
-   removed the option to choose type of data ("entire data" vs "only snippets") by enabling manual detection for the type of data (entire data is an object and snippets is an array)
-   Selectors in site block modal css were interfering with normal webpages.
-   Context menu snippet insertion was non-functional.
-   No feature was working in Gmail subject field
-   "Choose file" link in Restore popup was non-functional.

**3.0.0.1** - 27/May/2016

-   linted the js files
-   fixed two embarrrasing typos in change log
-   fixed the error in Snip.fromObject where snip.timestamp was undefined

**3.0.0** - 27/May/2016

-   made snippet handling OOP, added folder suppet
-   logo redesign (thanks [Varun](https://github.com/iWrote)!)
-   removed snippets popup, listing snippets in options page now
-   completely redesigned the options page, made responsive till 200% zoom
-   fixed: https://github.com/GaurangTandon/ProKeys/issues/3
-   first install should open popup box directly and give a greeting message/explaining 3.0.0 changes - done
-   fix for certain keycodes not corresponding with their actual key name (in hotkey feature) - fixed for numpad keys, comma and backtick; UNCHECKED for other OS; https://jsfiddle.net/zvtrn4vc/
-   remove case-sensitivity for snippet names
-   two digit year date/time macro added
-   removed snippet character limits
-   changed "Restore" backup to `<input type="file">`
-   removed googleBool in setText
-   removed delete dialog, replaced with simple window.alert
-   added export, import, past revisions buttons in the Snippet page
-   added past edited, added, deleted snips restore facility
-   removed `bannedElementNodes` String array, which was an attempt to fix issue #3
-   create uniformity in naming convention - "name" and "body" only; eliminate "long" and "short"
-   create uniformity in css class naming regarding dash and underscore - all switched over to underscore
-   if the user accidentally presses the completing parenthesis [')'] out of habit then prokeys should delete a ')' to give ['()'] instead of ['())'] - only valid when user does not insert any char in between
-   remove blocking of ReactJS elements
-   removed the condition [][word] in Generic.isValidName which made special fixes for snippet names like "constructor"

<details><summary><h3>Old versions (click to expand)</h3></summary><p>
**2.7.0** - 24/01/2015
- block site access in context menu
- insert snippet from context menu
- enabled for wepaste.com
- fixed issue for iframes not being blocked when parent page is blocked
- button/select/etc. element keydown getting delayed due to prokeys interference - bug fixed
- added tabbing in popup.js for dropdown elements for keyboard accessibility
- added info in Help regarding some sites not working

**2.6.2.1** - 30/10/2015

-   fix for single key hotkey not inserting default char when no snippet found

**2.6.2** - 26/10/2015

-   fix for multiline bold elements not working
-   complete change in setup of snippets/placeholder working (for third time ;) but this one is best and final!)

**2.6.1** - 21/10/2015

-   (green) highlight snippet on save, edit to indicate save
-   fix for nested placeholder elements

**2.6.0.1** - 18/10/2015

-   upload zip of compressed files (reduce size to around 42KB :) )
-   refactored popup.js
-   fix for snippets+other features not working in Gmail subject line/to field
-   fix for placeholder feature not working with element nodes (like `<b>%Order%</b>`)
-   debounced both handleKeyPress/Down

**2.6.0** - 06/10/2015

-   shorter image names
-   minified images - saving nearly 10 KB :)
-   fix for [excessive CPU usage issue](https://github.com/GaurangTandon/ProKeys/issues/3)
-   disabled ProKeys for input boxes using ReactJS (they possess `reactid` in `dataset`)
-   refactored detector.js code and others with ESLint
-   fix for bug when pressing hotkey while having some text selected
-   fix for GitHub, JSFiddle, and other sites which use their own editor (CodeMirror, ace, etc. which interferes with ProKeys)

**2.5.4** - 14/08/2015

-   changes in links to the tryit editor in Help section
-   fix super ugly bug of "Search" button in popup

**2.5.3** - 06/07/2015

-   changes to symbol list order (small to large time duration)
-   super bug fix for mathomania!
-   quick bug fixes
-   refactored popup.js code with bling.js
-   help page is now the default page in options.html

**2.5.2** - 05/07/2015

-   support for date and time arithmetic, relative as well as independent
-   organized symbols, variables into a clean table
-   revamped sample snippets shown on first intall
-   introduced TryIt editor in Help page

**2.5.1** - 04/07/2015

-   fixed a strange issue where on empty snippet was initially shown on install

**2.5.0** - 04/07/2015

-   added case-sensitive notice to snippet name
-   Nice notifications for install and update
-   injecting script automatically on install on most webpages
-   sync storage support
-   tab key space support removed for input elements
-   added "MM" symbol for numeric month in date-time macros
-   added “Variables” concept
-   improved restore functionality with descriptive error messages
-   severe code refactoring to show off on GitHub!

**2.4.6** - 03/05/2015

-   removed coloring of counterChecker’s display message (“You have x chars left”)
-   fixed bug of textarea height
-   removed minimum char limits on snip body and name. Increased body max limit to 2000 characters.
-   some code refactoring as well
-   made “date-time-macros sample” snippet more helpful
-   updated Opera 1.2.0 release

**2.4.5.1** - 15/04/2015

-   added support for Evernote beta
-   fixed bytes available link in popup html
-   removed support for password input
-   updated Opera 1.1.0 release

**2.4.5** - 13/04/2015

-   added support for all <input> elements except email/number (because they don’t support caret manipulation)

**2.4.4.1** - 05/04/2015

-   removed console.log’s, which were left erroneously, and were used for development purpose
-   css changes to popup

**2.4.4** - 04/04/2015

-   Facebook Chat, Atlassian (Confluence), Evernote, Mailchimp, Basecamp support added

**2.4.3** - 30/03/2015

-   made popup.html and options.html responsive for 200x zoom and 67% zoom both!
-   fixed the issue of “none currently” showing in character-counterpart pairs
-   fixed site blocker errors
-   fixed issue in backup/restore functionality
-   added support for SalesForce, Slack

**2.4.2** - 12/03/2015

-   fixed silly bugs
-   fixed site blocker not working for gmail
-   compressed manifest.json
-   Opera 1.0.0 release

**2.4.1** - 11/03/2015

-   Added option to change hotkey for snippet substitution
-   added flattr button

**2.4.0** - 05/03/2015

-   date and time macros are here!
-   added one sample snippet for date-time macros
-   added You have used 1860 bytes out of 102,400 bytes; 11 snippets currently notice

**2.3.0** - 09/11/2014

-   Support rich text format (bold, italic, underline)
-   options page improvement
-   changed snippet viewing to down arrow in popup window
-   added helpful sample snippets

**2.2.0** - 01/11/2014

-   Fixed the white space collapse problem, by changing the text nodes to span element nodes and completely revamping the functioning of popup.js due to this
-   Reduced the line-height of the snippet body in popup window

**2.1.0** - 01/10/2014

-   mathomania fixes
-   validation format changed

**2.0.0** - 11/09/2014

-   Mathomania (type and do math)
-   Sync storage
-   Options page responsive (for smaller screens)
-   print a list of snippets/settings
-   backup and restore of settings/snippets
-   accidental shift+space produces space and not snippet or error
-   added window.onerror

    changes preceding this version are just too minor (and bad)
    to be shown;

**1.0.0** - 25/June/2014

-   ProKeys released
    </p></details>
