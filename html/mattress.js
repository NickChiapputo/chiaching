import {send} from "./send.js";
import * as modal from "./modal.js";
import * as forms from "./forms.js";


export const init = () => {
    newMattressForm.addEventListener( "submit", submitMattressForm );
    mattressTransferForm.addEventListener( "submit", submitMattressTransferForm );
    addMattressButton.addEventListener( "click", showNewMattressForm );
    mattressTransferButton.addEventListener( "click", showTransferForm );

    let editButtons = document.getElementsByClassName( "inputEditButton" );
    mattressInputEditButtons = [];
    for( let b of editButtons ) {
        if( !newMattressForm.contains(b) ) continue;
        mattressInputEditButtons.push(b);
        b.addEventListener( "click", (e) => forms.editButtonAction(e, newMattressSubmit) );
    }

    // If one selection is changed, disable that option in
    // the other select and enable the remaining options.
    transferMattressSource.addEventListener( "change", e => {
        for( let opt of transferMattressDestination.options ) {
            opt.disabled = transferMattressSource.value == opt.value;
        }
    });
    transferMattressDestination.addEventListener( "change", e => {
        for( let opt of transferMattressSource.options ) {
            opt.disabled = transferMattressDestination.value == opt.value;
        }
    });


    getMattresses();
};

export const getMattresses = () => {
    send( "/api/mattresses/getNames", "GET", null,
        (resp, status) => {
            // Display in mattresses section.
            mattresses = [];
            resp.names.sort( (a, b) =>
                a.localeCompare( b, undefined, { sensitivity: "base" } )
            );
            resp.names.forEach( getAndDisplayMattress );
        },
        (e, resp, status) => {
            console.error( e );
            console.log( status, resp );
        },
        true
    );
};

export var mattresses = [];

const UNALLOCATED_MATTRESS_NAME = "unallocated";
const mattressInputFields = [
    mattressName,
    mattressMaxAmount,
    mattressInitialAmount,
    newMattressSubmit,
]
var mattressInputEditButtons = [];

function getAndDisplayMattress(mattressName)
{
    let query = {
        name: mattressName,
    };

    send( "/api/mattresses/get", "POST", query,
        (resp, status) => {
            mattresses.push( resp.mattress );
            displayMattress( resp.mattress );
        },
        (e, resp, status) => {
            console.error( e );
            console.log( status, resp );
        },
        true
    );
};

function displayMattress( mattress )
{
    // Check if mattress already exists in mattress list.
    let existingElement = null;
    for( let child of mattressList.children ) {
        if( child.getAttribute( "_id" ) == mattress._id ) {
            existingElement = child;
            break;
        }
    }

    let container = document.createElement( "div" );
    container.classList.toggle( "mattressContainer" );
    container.setAttribute( "_id", mattress._id );

    let title = document.createElement( "span" );
    title.classList.toggle( "mattressTitle" );
    title.innerHTML = mattress.name;

    let bar = document.createElement( "div" );
    bar.classList.toggle( "mattressBar" );
    let percent = 100 * mattress.amount / mattress.maxAmount;
    bar.style.background = `linear-gradient(to top, var(--Green), var(--Green) ${percent}%, transparent 0%, transparent)`;

    let amounts = document.createElement( "span" );
    amounts.classList.toggle( "mattressAmounts" );
    amounts.innerHTML = `$${mattress.amount} / $${mattress.maxAmount}`;

    let editButton = document.createElement( "img" );
    editButton.classList.toggle( "mattressEditButton" );
    editButton.src = "/media/edit-pencil.svg";
    editButton.for = mattress.name;
    editButton.addEventListener( "click", showEditMattressForm );

    container.appendChild( title );
    container.appendChild( bar );
    container.appendChild( amounts );
    container.appendChild( editButton );

    if( existingElement !== null ) {
        existingElement.replaceWith( container );
    } else {
        mattressList.appendChild( container );
    }
}

function submitMattressForm(e) {
    // Don't reload page after submitting.
    e.preventDefault();

    if( newMattressSubmit.editing ) {
        editMattress(e);
    } else {
        createNewMattress(e);
    }

    return false;
}

function createNewMattress(e) {
    let data = {
        "name": mattressName.value,
        "maxAmount": mattressMaxAmount.value,
        "amount": mattressInitialAmount.value,
    };

    newMattressSubmit.value = "Creating...";
    newMattressSubmit.disabled = true;

    send(
        "/api/mattresses/create", "POST", data,
        (resp, status) => {
            newMattressSubmit.value = "Success!";
            getMattresses();
            modal.hide();
        },
        (e, resp, status) => {
            newMattressSubmit.value = `Error! ${status}`;
            newMattressSubmit.disabled = false;
        },
        true
    );
}

function editMattress(e) {
    newMattressSubmit.value = "Submitting...";
    newMattressSubmit.disabled = true;

    let update = {
        "_id": newMattressSubmit.mattressID,
    };

    if( mattressName.classList.contains( "edited" ) )
        update.name = mattressName.value;
    if( mattressMaxAmount.classList.contains( "edited" ) )
        update.maxAmount = mattressMaxAmount.value;

    send(
        "/api/mattresses/edit", "POST", update,
        (resp, status) => {
            newMattressSubmit.value = "Success!";
            getMattresses();
            modal.hide();
        },
        (e, resp, status) => {
            newMattressSubmit.value = `Error! ${status}`;
            newMattressSubmit.disabled = false;
        },
        true
    );
}

function submitMattressTransferForm(e) {
    e.preventDefault();

    mattressTransferSubmit.value = "Transferring...";
    mattressTransferSubmit.disabled = true;

    let data = {
        "source": transferMattressSource.value,
        "destination": transferMattressDestination.value,
        "amount": mattressTransferAmount.value,
    };

    send(
        "/api/mattresses/transfer", "POST", data,
        (resp, status) => {
            mattressTransferSubmit.value = "Success!";
            getMattresses();
            modal.hide();
        },
        (e, resp, status) => {
            mattressTransferSubmit.value = `Error! ${status}`;
            mattressTransferSubmit.disabled = false;
        },
        true
    );

    return false;
}

function clearMattresses()
{
    mattressList.innerHTML = '';
}

function clearMattressFormInputs(disabled) {
    if( disabled === undefined )
        disabled = false;
    mattressInputFields.forEach(f => {
        f.value = "";
        f.disabled = disabled;
        f.classList.remove( "edited" );
    });
}

function showNewMattressForm(e)
{
    // Clear form.
    clearMattressFormInputs(false);
    mattressInitialAmount.parentElement.style.display = "";
    newMattressSubmit.value = "Submit";
    newMattressSubmit.editing = false;
    mattressInputEditButtons.forEach(b => b.style.display = "none");

    // Show form.
    modal.selectContent( modal.ModalContent.MATTRESS );
    modal.show();
}

function showEditMattressForm(e) {
    // Get mattress info
    let mattress = mattresses.find((m) => m.name == e.target.for);
    console.log(mattress);

    // Populate modal form
    clearMattressFormInputs(true);
    mattressName.value = mattress.name;
    mattressMaxAmount.value = mattress.maxAmount;
    mattressInitialAmount.parentElement.style.display = "none";
    newMattressSubmit.value = "No Changes";
    newMattressSubmit.mattressID = mattress[ "_id" ];
    newMattressSubmit.editing = true;

    mattressInputEditButtons.forEach(b => b.style.display = "");

    // Show modal
    modal.selectContent( modal.ModalContent.MATTRESS )
    modal.show();
}

function showTransferForm(e) {
    // Populate inputs.
    mattressTransferAmount.value = '';
    transferMattressSource.innerHTML = '<option></option>';
    transferMattressDestination.innerHTML = '<option></option>';

    // Add the unallocated mattress.
    let unallocatedOption = document.createElement( "option" );
    unallocatedOption.innerHTML = UNALLOCATED_MATTRESS_NAME;
    unallocatedOption.value = UNALLOCATED_MATTRESS_NAME;

    transferMattressSource.appendChild(unallocatedOption);
    transferMattressDestination.appendChild(unallocatedOption.cloneNode(true));

    // Add the user's mattresses.
    mattresses.forEach(mattress => {
        let opt = document.createElement( "option" );
        opt.innerHTML = `${mattress.name} — $${mattress.amount}`;
        opt.value = mattress._id;

        transferMattressSource.appendChild(opt);
        transferMattressDestination.appendChild(opt.cloneNode(true));
    });


    // Show modal
    mattressTransferSubmit.disabled = false;
    mattressTransferSubmit.value = "Transfer";
    modal.selectContent( modal.ModalContent.MATTRESS_TRANSFER );
    modal.show();
}
