import {send} from "./send.js"

export const init = () => {
    transactionSearchInput.value = "";
    transactionSearchButton.addEventListener( "click", e => {
        transactionSearchInput.classList.toggle( "hidden" )
    } );
}