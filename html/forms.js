export {
    editButtonAction,
};

const editButtonAction = (e, submitButton) => {
    // Get the element we are editing
    let editElement = document.getElementById(e.target.getAttribute("for"));
    if( editElement == undefined ) return;
    editElement.disabled = false;

    // Give the element under edit (EUE) user focus.
    editElement.focus();

    // Add an event listener to enable the submit button if the transaction
    // detail has been edited.
    let inputHandler = e => {
        editElement.classList.add( "edited" );

        submitButton.disabled = false;
        submitButton.value = "Submit Changes";
    };
    editElement.addEventListener( "input", inputHandler );

    // Add an event listener to the element under edit (EUE) to re-disable
    // it after the user leaves focus from the EUE and remove the event
    // listeners.
    let focusoutHandler = e => {
        editElement.disabled = true;
        editElement.removeEventListener( "focusout", focusoutHandler );
        editElement.removeEventListener( "input", inputHandler );
    };
    editElement.addEventListener( "focusout", focusoutHandler );
};
