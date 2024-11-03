export {
    ModalContent,
    init,
    show,
    hide,
    selectContent,
}

const ModalContent = Object.freeze({
    TRANSACTION: 0,
    MATTRESS: 1,
});

const Forms = [
    newTransactionForm,
    newMattressForm,
];

/**
 * Initialize the modal. Set event listeners.
 */
const init = () => {
    modalExitButton.addEventListener( "click", e => hide() );
    modalContainer.addEventListener( "click", e => {
        if( e.target == modalContainer ) hide();
    } );
};

const hideContent = () => {
    Forms.forEach((form) => {
        form.style.display = "none";
    });
};

const selectContent = (content) => {
    hideContent();
    if( content == ModalContent.TRANSACTION ) {

    } else if ( content == ModalContent.MATTRESS ) {
        newMattressForm.style.display = "";
    }
};

const show = () => {
    clearClasses();
    modalContainer.classList.add( "modalShow" );
    modal.classList.add( "modalShow" );
};

const hide = () => {
    clearClasses();
    modalContainer.classList.add( "modalHidden" );
    modal.classList.add( "modalHidden" );
};

const clearClasses = () => {
    modalContainer.classList.remove( "modalHidden" );
    modalContainer.classList.remove( "modalShow" );
    modal.classList.remove( "modalHidden" );
    modal.classList.remove( "modalShow" );
}