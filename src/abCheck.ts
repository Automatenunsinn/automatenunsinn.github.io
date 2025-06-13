export default function abCheck(): boolean {
    if (window.location.hostname.includes("ast")) {
        console.warn("vorsicht");
        return false;        
    }
    return true;
}