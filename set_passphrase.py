#!/usr/bin/env python3
"""Set or change the Collector Box Quest passphrase hash.

The passphrase is never written to disk. Only a random salt and a PBKDF2-SHA256
hash are stored in collector_boxes.json. Commit and push that file afterward.
"""
import getpass, hashlib, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "collector_boxes.json")
ITERS = 100_000

def derive(password, salt, iterations=ITERS):
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations, dklen=32).hex()

def main():
    phrase = getpass.getpass("New passphrase: ")
    again = getpass.getpass("Repeat passphrase: ")
    if not phrase:
        sys.exit("Passphrase cannot be empty.")
    if phrase != again:
        sys.exit("The two entries did not match.")
    salt = os.urandom(16)
    with open(DB) as f:
        doc = json.load(f)
    prev = doc.get("unlock") if isinstance(doc.get("unlock"), dict) else {}
    doc["unlock"] = {
        "kdf": "PBKDF2-SHA256",
        "iterations": ITERS,
        "salt": salt.hex(),
        "hash": derive(phrase, salt),
    }
    if isinstance(prev.get("vault"), dict):
        doc["unlock"]["vault"] = prev["vault"]
    with open(DB, "w") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("Wrote the salted hash into collector_boxes.json.")
    print("The passphrase itself was not saved. Commit and push collector_boxes.json to main.")
    print("The hash only gates the ritual screen. The sealed token in unlock.vault is what allows a save.")
    if isinstance(prev.get("vault"), dict):
        print("The sealed token was left in place. It still opens only with the previous passphrase, so run device setup again after this hash is on main.")

if __name__ == "__main__":
    main()
