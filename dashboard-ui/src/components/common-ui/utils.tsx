// Will set the elements with classes signedIn and signedOut to display: inline-block or display: none depending
// on the isLoggedIn value. e.g. signedIn elements are visible when isLoggedIn is true.
export function showLoginLogoutButtons(isLoggedIn: boolean | undefined) {
    setElementDisplayByClassName("signedIn", isLoggedIn ? "inline-block" : "none");
    setElementDisplayByClassName("signedOut", !isLoggedIn ? "inline-block" : "none");
}

export function setClickEventByClassName(className: string, clickFn: (() => void) | undefined) {
    if (!clickFn) {
        return;
    }

    const elements = document.getElementsByClassName(className);
    for (let i = 0; i < elements.length; i++) {
        elements[i].addEventListener('click', clickFn);
    }
}

export function setClickEventById(id: string, clickFn: (() => void) | undefined) {
    if (!clickFn) {
        return;
    }

    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('click', clickFn);
    }
}


export function setElementDisplayByClassName(className: string, displayValue: string) {
    const elements = document.getElementsByClassName(className);
    for (let i = 0; i < elements.length; i++) {
        (elements[i] as HTMLElement).style.display = displayValue;
    }
}

export function setElementDisplayById(id: string, displayValue: string) {
    const element = document.getElementById(id);
    if (element) {
        (element as HTMLElement).style.display = displayValue;
    }
}
