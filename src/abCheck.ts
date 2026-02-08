export default function abCheck(): boolean {
    if (typeof window !== 'undefined') {
        if (window.location.hostname.includes("astl")) {
            return false;        
        }
    }
    return true;
}
