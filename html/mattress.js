import {send} from "./send.js";
import * as modal from "./modal.js";
import * as forms from "./forms.js";


export const init = () => {
    newMattressForm.addEventListener( "submit", submitMattressForm );
    addMattressButton.addEventListener( "click", showNewMattressForm );

    let editButtons = document.getElementsByClassName( "inputEditButton" );
    mattressInputEditButtons = [];
    for( let b of editButtons ) {
        if( !newMattressForm.contains(b) ) continue;
        mattressInputEditButtons.push(b);
        b.addEventListener( "click", (e) => forms.editButtonAction(e, newMattressSubmit) );
    }

    getMattresses();
};

export var mattresses = [];


const mattressInputFields = [
    mattressName,
    mattressMaxAmount,
    mattressInitialAmount,
    newMattressSubmit,
]
var mattressInputEditButtons = [];
function getMattresses() {
    send( "/api/mattresses/getNames", "GET", null,
        (resp, status) => {
            // Display in mattresses section.
            clearMattresses();
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
}

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
    let container = document.createElement( "div" );
    container.classList.toggle( "mattressContainer" );

    let title = document.createElement( "span" );
    title.classList.toggle( "mattressTitle" );
    title.innerHTML = mattress.name;

    let bar = document.createElement( "div" );
    bar.classList.toggle( "mattressBar" );
    let percent = 100 * mattress.amount / mattress.maxAmount;
    bar.style.background = `linear-gradient(to top, green, green ${percent}%, transparent 0%, transparent)`;

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

    mattressList.appendChild( container );
}

function submitMattressForm(e) {
    if( newMattressSubmit.editing ) {
        editMattress(e);
    } else {
        createNewMattress(e);
    }

    // Don't reload page after submitting.
    e.preventDefault();
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
    console.log( `Updating: ${JSON.stringify(update, null, 2)}`);
}

function clearMattresses()
{
    mattressList.innerHTML = '';
}

function showNewMattressForm(e)
{
    // Clear form.
    mattressInputFields.forEach(f => {
        f.value = "";
        f.disabled = false;
    });
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
    mattressName.value = mattress.name;
    mattressMaxAmount.value = mattress.maxAmount;
    mattressInitialAmount.parentElement.style.display = "none";
    newMattressSubmit.value = "No Changes";
    newMattressSubmit.mattressID = mattress[ "_id" ];
    newMattressSubmit.editing = true;

    // Disable form inputs by default
    mattressInputFields.forEach(f => f.disabled = true);
    mattressInputEditButtons.forEach(b => b.style.display = "");

    // Show modal
    modal.selectContent( modal.ModalContent.MATTRESS )
    modal.show();
}
