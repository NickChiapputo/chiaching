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
    MATTRESS_TRANSFER: 2,
});

const Forms = [
    newTransactionForm,
    newMattressForm,
    mattressTransferForm,
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
    Forms[ content ].style.display = "";
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

    // On Firefox, the calendar icon will show through any
    // elements on top of the date input.
    transactionListStartDate.disabled = false;
    transactionListEndDate.disabled = false;
};

const clearClasses = () => {
    modalContainer.classList.remove( "modalHidden" );
    modalContainer.classList.remove( "modalShow" );
    modal.classList.remove( "modalHidden" );
    modal.classList.remove( "modalShow" );
}