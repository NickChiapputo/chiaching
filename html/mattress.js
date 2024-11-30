import {send} from "./send.js";
import * as modal from "./modal.js";
import * as forms from "./forms.js";
import {accounts, numberToCurrencyString} from "./index.js";


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
        async (resp, status) => {
            // Sort mattresses alphabetically.
            resp.names.sort( (a, b) =>
                a.localeCompare( b, undefined, { sensitivity: "base" } )
            );

            // Reset mattress list.
            mattresses = [];

            // Display each mattress sequentially.
            // Because this function makes API requests to fill out the mattress
            // information, the mattress won't be guaranteed to be in order.
            // Awaiting will guarantee this but will slow down the process some.
            // It would be possible to create the placeholders and then request
            // the mattress asynchronously, but that is more code I don't want
            // or need to write.
            for( const name of resp.names ) {
                await getAndDisplayMattress( name );
            }

            // Create the "unallocated" mattress.
            let unallocated_mattress = getUnallocatedMattress();

            displayMattress( unallocated_mattress, true );
            mattresses.push( unallocated_mattress );

            // Iterate through the mattresses in the UI. If the mattress does
            // not exist in the new mattress list, remove it from the UI.
            for( let child of mattressList.children ) {
                let mattress = mattresses.find(
                    m => m[ "_id" ] == child.getAttribute( "_id" )
                );
                if( mattress !== undefined ) continue;
                mattressList.removeChild( child );
            }
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
];
var mattressInputEditButtons = [];

async function getAndDisplayMattress(mattressName)
{
    let query = {
        name: mattressName,
    };

    await send( "/api/mattresses/get", "POST", query,
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

function findExistingMattressContainer(mattress) {
    let existingElement = null;
    for( let child of mattressList.children ) {
        if( child.getAttribute( "_id" ) == mattress._id ) {
            existingElement = child;
            break;
        }
    }

    return existingElement;
}

function displayMattress( mattress, is_unallocated )
{
    // Ensure this is a boolean.
    is_unallocated = is_unallocated === true;

    // Check if mattress already exists in mattress list.
    let existingElement = findExistingMattressContainer( mattress );

    let container = document.createElement( "div" );
    container.classList.toggle( "mattressContainer" );
    container.setAttribute( "_id", mattress._id );

    let title = document.createElement( "span" );
    title.classList.toggle( "mattressTitle" );
    title.innerHTML = mattress.name;

    let bar = document.createElement( "div" );
    bar.classList.toggle( "mattressBar" );
    let percent = is_unallocated ?
        0.0 : 100 * mattress.amount / mattress.maxAmount;
    bar.style.background = `linear-gradient(to right, var(--Green), var(--Green) ${percent}%, transparent 0%, transparent)`;

    let amount = document.createElement( "span" );
    amount.classList.toggle( "mattressAmounts" );
    if( !is_unallocated ) {
        amount.innerHTML = numberToCurrencyString(mattress.amount);
    }

    let amount_spacer = document.createElement( "span" );
    amount_spacer.innerHTML = ' / ';

    let max_amount = document.createElement( "span" );
    max_amount.classList.toggle( "mattressAmounts" );
    max_amount.innerHTML = numberToCurrencyString(
        is_unallocated ? mattress.amount : mattress.maxAmount);
    if( is_unallocated ) {
        max_amount.classList.toggle( "unallocatedMattressMaxAmount" );
    }

    container.appendChild( title );
    container.appendChild( bar );
    if( !is_unallocated ) {
        container.appendChild( amount );
        container.appendChild( amount_spacer );
    }
    container.appendChild( max_amount );

    if( is_unallocated ) {
        container.classList.toggle( "unallocated" );
        container.title = `${numberToCurrencyString(mattress.amount)} unallocated funds`;
    } else {
        container.addEventListener( "click", e => showEditMattressForm( mattress.name ) );
        container.title = `${mattress.name} ${percent.toFixed(2)}% full, ${numberToCurrencyString(mattress.amount)} / ${numberToCurrencyString(mattress.maxAmount)}`;
    }

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
    let update = {
        "_id": newMattressSubmit.mattressID,
    };
    let endpoint = '';
    let button = undefined;
    if( e.submitter == newMattressDelete ) {
        endpoint = "/api/mattresses/delete";
        button = newMattressDelete;
        newMattressDelete.value = "Deleting...";
    } else {
        endpoint = "/api/mattresses/edit";
        button = newMattressSubmit;
        newMattressSubmit.value = "Submitting...";

        if( mattressName.classList.contains( "edited" ) )
            update.name = mattressName.value;
        if( mattressMaxAmount.classList.contains( "edited" ) )
            update.maxAmount = mattressMaxAmount.value;
    }

    newMattressSubmit.disabled = true;
    newMattressDelete.disabled = true;
    send(
        endpoint, "POST", update,
        (resp, status) => {
            button.value = "Success!";
            getMattresses();
            modal.hide();
        },
        (e, resp, status) => {
            button.value = `Error! ${status}`;
            button.disabled = false;
            newMattressDelete.disabled = false;
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
    newMattressDelete.style.display = "none";
    mattressInputEditButtons.forEach(b => b.style.display = "none");

    // Show form.
    modal.selectContent( modal.ModalContent.MATTRESS );
    modal.show();
}

function showEditMattressForm(name) {
    // Get mattress info
    let mattress = mattresses.find((m) => m.name == name);

    // Populate modal form
    clearMattressFormInputs(true);
    mattressName.value = mattress.name;
    mattressMaxAmount.value = mattress.maxAmount;
    mattressInitialAmount.parentElement.style.display = "none";
    newMattressSubmit.value = "No Changes";
    newMattressSubmit.mattressID = mattress[ "_id" ];
    newMattressSubmit.editing = true;
    newMattressDelete.style.display = "";
    newMattressDelete.disabled = false;

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

    // Add the user's mattresses.
    mattresses.forEach(mattress => {
        let opt = document.createElement( "option" );
        opt.innerHTML = `${mattress.name} —  ` +
            `${numberToCurrencyString(mattress.amount)}`;
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

function getUnallocatedMattress() {
    let amount = 0.0;
    for( let institution in accounts ) {
        accounts[ institution ].forEach((account) => {
            amount += account.balance;
        });
    }

    mattresses.forEach((mattress) => {
        if( mattress.name == UNALLOCATED_MATTRESS_NAME ) return;
        amount -= mattress.amount;
    });

    return {
        "_id": UNALLOCATED_MATTRESS_NAME,
        "name": UNALLOCATED_MATTRESS_NAME,
        "amount": amount,
    };
}
