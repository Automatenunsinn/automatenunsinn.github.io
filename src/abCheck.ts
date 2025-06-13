export default function abCheck(): boolean {
    if (window.location.hostname.includes("ast")) {
        return false;        
    }
    return true;
}