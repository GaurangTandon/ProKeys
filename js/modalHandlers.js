/* global Data */

import { q } from "./pre";
import { saveOtherData } from "./commonDataHandlers";

// serves as an addon to the content script for handling
// hiding/showing the modal
// attach click/keypress handler for the two buttons
function attachModalHandlers(modal, shouldBlockSite) {
    function keyHandlerCreator(handler) {
        return function (e) {
            if (e.keyCode === 13) {
                handler.call(this, e);
            }
        };
    }
    let URL;
    const msgElm = modal.qClsSingle("block-dialog-message"),
        buttons = modal.qCls("block-dialog-button"),
        [OKBtn, cancelBtn] = buttons,
        siteInputElm = modal.q(".block-dialog-form input"),
        siteNameInput = modal.qClsSingle("site-name"),
        btnContainer = modal.qClsSingle("block-dialog-buttons");

    function success() {
        const txt = `${shouldBlockSite ? "" : "un"}blocked`,
            reloadHandler = function () {
                window.location.reload();
            },
            reloadHandlerKeyup = keyHandlerCreator(reloadHandler),
            reloadBtn = q
                .new("BUTTON")
                .html("Reload page")
                .on("click", reloadHandler)
                .on("keyup", reloadHandlerKeyup);

        msgElm.text(`URL ${URL} has been ${txt}. Reload page for changes to take effect.`);
        btnContainer.removeChild(OKBtn);
        cancelBtn.html("Close dialog box");

        reloadBtn.classList.add("block-dialog-button-primary", "block-dialog-button");
        reloadBtn.style.marginRight = "10px";

        btnContainer.insertBefore(reloadBtn, cancelBtn);

        reloadBtn.focus();
    }

    function closeModal() {
        modal.parentNode.removeChild(modal);
    }

    function OKBtnEvent() {
        URL = siteNameInput.value;

        if (shouldBlockSite) {
            Data.blockedSites.push(URL);
            saveOtherData(success);
        } else {
            const idx = Data.blockedSites.indexOf(URL);

            if (idx !== -1) {
                Data.blockedSites.splice(idx, 1);
                // since we transform cancelBtn into close modal btn
                // suddenly, the enter keyup event on the OK Btn
                // gets transferred to close modal btn
                // closing the modal almost immediately.
                // 1000ms delay experimentally established
                saveOtherData(success);
            } else {
                // create regex after removing the part after /
                const regex = new RegExp(URL.replace(/\/.*$/gi, ""), "gi"),
                    userMeant = Data.blockedSites.filter(blockedSite => regex.test(blockedSite));

                let alertText = `URL ${URL} is already unblocked. Please see the Settings page for list of blocked sites.`;

                if (userMeant.length > 0) {
                    alertText += ` Or maybe you meant a blocked site from one of the following: ${userMeant.join(
                        ", ",
                    )}`;
                }

                alert(alertText);
            }
        }
    }

    const keyCloseModal = keyHandlerCreator(closeModal),
        keyOKBtn = keyHandlerCreator(OKBtnEvent);

    OKBtn.on("click", OKBtnEvent).on("keyup", keyOKBtn);
    cancelBtn.on("click", closeModal).on("keyup", keyCloseModal);
    siteInputElm.on("keyup", keyOKBtn);
}

// alert user about difference of xyz.com/path vs xyz.com
function getURLAlertingText(url) {
    url = url.split("/");

    const [site, path] = url;

    if (!path) {
        return "";
    }
    return `Remember that you have to remove the /${path} part of the URL above to block the entire ${site} site.`;
}

function showBlockSiteModal(msg) {
    const modal = q.new("div").html(msg.modal).firstChild,
        { action } = msg,
        shouldBlockSite = action === "Block",
        siteNameElm = modal.qClsSingle("site-name"),
        // alert user about difference of xyz.com/path vs xyz.com
        // only alert when user is blocking site
        URLAlertingText = shouldBlockSite ? getURLAlertingText(msg.url) : "";

    attachModalHandlers(modal, shouldBlockSite);

    modal.qClsSingle("action").html(action);
    siteNameElm.html(msg.url);

    if (URLAlertingText !== "") {
        modal.qClsSingle("block-dialog-message").appendChild(q.new("P").html(URLAlertingText));
    }

    window.document.body.appendChild(modal);
    siteNameElm.focus();
}
export { showBlockSiteModal };
