use aes_gcm::aead::{Aead, NewAead, Payload};
use aes_gcm::Aes256Gcm; // Or another encryption algorithm
use rand::Rng;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn fernet_encrypt(key: &[u8], data: &[u8]) -> Vec<u8> {
    // Create an AES-256-GCM encryption key
    let cipher = Aes256Gcm::new_from_slice(key).expect("Invalid key length");

    // Generate a random nonce
    let nonce: [u8; 12] = rand::thread_rng().gen();

    // Encrypt the data
    let ciphertext = cipher
        .encrypt(&nonce.into(), data.as_ref())
        .expect("Encryption failed");

    // Return the nonce + ciphertext
    [nonce.to_vec(), ciphertext].concat()
}
