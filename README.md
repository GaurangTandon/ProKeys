[![prokeys logo](https://i.stack.imgur.com/HrCnC.png)](https://chrome.google.com/webstore/detail/prokeys/ekfnbpgmmeahnnlpjibofkobpdkifapn)

**Developed by**: Aquila Softworks ([Gaurang Tandon](https://github.com/GaurangTandon), [Jaidev Shriram](http://github.com/jaidev123), [Yoogottam Khandelwal](https://github.com/yoogottamk) and [Varun Singh](https://github.com/iWrote))  

### UPDATE (May 2020)

Work on this project had come to a halt for quite a long time, and we have now taken the sad decision to suspend all activity on this project (this also includes answering customer queries or fixing critical vulnerabilities if any). We are college students who are caught up in our own collegework and side-projects, and are unfortunately unable to find the time or energy to work on this project anymore. 

I (Gaurang) had originally conceived this project five years ago, and I have appreciated the long term association with this, and the learning I have gained by working on this, as well as by interacting with several valuable customers. To date I have received hundreds of emails, and replied to many of them. Even if I had not replied to your mail, please be assured I had definitely read it but could not reply due to time constraints.

Entire organizations have used this project - which merely started as a side project for me - in their customer service units, and I am more than honored to have started a project that was - at its peak - used by 30k+ users globally. I appreciate all the love and support this project got from all the users, and I am forever thankful to them.

**If you still use ProKeys, do not worry!** It will continue to work as it has worked so far. I own the extension on the Web Store, and I am NOT going to sell this extension off to a third party, since I am aware that this extension handles critical personal user data, and the chances that a third party could potentially sell that data are large.

**Note**: Even though work on this project is halted, we are not giving up the rights to the name on the Web Store. The ProKeys extension still continues to exist on the Web Store. It is still being regularly used by 20k+ users globally. The license terms still remain intact.

![version](https://img.shields.io/chrome-web-store/v/ekfnbpgmmeahnnlpjibofkobpdkifapn.svg?label=version&style=flat-square) ![users](https://img.shields.io/chrome-web-store/users/ekfnbpgmmeahnnlpjibofkobpdkifapn.svg?style=flat-square) ![rating](https://img.shields.io/chrome-web-store/rating/ekfnbpgmmeahnnlpjibofkobpdkifapn.svg?style=flat-square)  
![deps](https://img.shields.io/librariesio/github/GaurangTandon/ProKeys.svg) ![repo size](https://img.shields.io/github/repo-size/GaurangTandon/ProKeys.svg) ![](https://img.shields.io/github/commit-activity/w/GaurangTandon/ProKeys.svg) ![](https://img.shields.io/github/last-commit/GaurangTandon/ProKeys.svg)  

ProKeys is a completely free, [Google Chrome](https://chrome.google.com/webstore/detail/prokeys/ekfnbpgmmeahnnlpjibofkobpdkifapn) and [Opera](https://addons.opera.com/en/extensions/details/prokeys/?display=en) extension that lets you be productive in online text-related work with its number of features like:

[More info on all these in Help section inside the app]

1.  **Snippets** - define custom abbreviations, and retrieve the text associated with them simply by pressing the hotkey (default: Shift+Space). Example: "brb" can expand to "Be right back!"
2.  **Placeholders** - are fields in the snippet body that can be given dynamic values on using the snippet.
3.  **Mathomania** - do math without leaving your text editor, and without calculators. Example: "[[ 15% * 600 =]]" gives "90" and "[[ (5+6) * 15^2 =]]" gives "2475".
4.  **Clipboard access** - insert `[[%p]]` anywhere in your snippet body. It will automatically be substituted with the current clipboard data.
5.  **Snippet embedding**: you can embed one or more snippets inside another snippet, simply by doing `[[%s(snip_name)]]`.
6.  **Auto-Insert** - Quotes ('"') and braces ('(', '[', '{') are auto-completed, and you can specify your custom insert-it-for-me also (like, inserting a '>' on typing of a '<') in the settings.
7.  **Date/Time Macros** - embed short symbols inside the parentheses of '[[%d()]]' inside a snippet body and it will auto replace the symbol with the current date and time related value. A sample snippet as well as a guide has been provided (in Help section inside the app). **Date/Time Arithmetic** - use the `+` or `-` sign to move forward or backward in time in date/time macros. Supports both relative as well as independent evaluation.
8.  **Omnibox support** - search through your snippets and use them right in the browser address bar!
9.  **URL Macro** - insert customizable parts of the current tab URL into the snippet.
10. **Variables** - built-in variables holding dynamic values for "date", "time" and (browser) "version"
11. **Tab Key** - The tab key can be made to insert 4 spaces, instead of it's default function, thus speeding up work.
12. **Context menu access** - for blocking sites and inserting snippets.
13. **Sync/Local storage** - Use whichever you prefer.

## Libraries/Code sources

Except for the feather-weight open-source QuillJS rich text editor, I only utilized vanilla JS for super performance and less app size. Also Eric Meyer's CSS reset stylesheet - public domain - has been used with modifications.

Some icon images have been sourced from Font Awesome 5. The license is at [this link](https://fontawesome.com/license/free). No changes (except scaling) were made to these images.

## Technical details

Are shared on [here](http://electricweb.org/chrome-extension-tutorial-snippets) in a long, three post series. In brief: this extension uses content scripts which are injected into every page and (what follows is for the snippet functionality only) every time the user presses the hotkey, a check is made for the preceding text, which if matches the name of any of the snippets, is substituted with the snippet body. A subsequent test for placeholders is made as well.

## Contribute

First of all, thanks for your contribution! Every small bit of it counts! You can:

1.  [Create a new issue](https://github.com/GaurangTandon/ProKeys/issues/new) for bugs, feature requests, and enhancements.
2.  [Write a review](https://chrome.google.com/webstore/detail/prokeys/ekfnbpgmmeahnnlpjibofkobpdkifapn/reviews) (or [anonymous feedback](https://docs.google.com/forms/d/1DcwQB5vnNCH0pP_Y-wVvOF6gsI0gaXGPPngctb4tCdA/viewform?usp=send_form)), or [get support](https://chrome.google.com/webstore/detail/prokeys/ekfnbpgmmeahnnlpjibofkobpdkifapn/support) with some technical problems.
3.  Fork the repo, make changes, and submit a pull request, describing the changes made.
4.  Help me translate ProKeys to your native language.
5.  Share the word about ProKeys with people!
6.  Monetary donations are gratefully accepted at email 1gaurangtandon@gmail.com using [PayPal](https://www.paypal.com/myaccount/transfer/buy)

## Development

To setup this repo, clone it, `cd` into it, and then run `npm run build`. This will create a unminified development build in `./dist` which you can then load into Chrome. This step is required because Chrome does not yet natively support `import`/`export` syntax for Chrome extensions.

We use both global variables and `import`/`export` ones. The `import`/`export` ones are either functions or unmodified constants. Only those variables are declared under `window` which need to be modified in different scripts.

**Contact us** - prokeys.feedback@gmail.com - to discuss anything related to the above if you want to.

## [Known Issues](https://docs.google.com/document/d/1_MHKm1jtpJCWgksfbUdufExRFlF81S-IuTz1Czu7gOI/edit?usp=sharing)

## [Change Log](https://github.com/GaurangTandon/ProKeys/blob/master/change_log.md)
