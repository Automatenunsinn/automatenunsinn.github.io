export default function abCheck() {
    if (typeof window !== 'undefined') {
        if (window.location.hostname.includes("astl")) {
            return false;
        }
    }
    return true;
}
