"""Privacy primitives used by the local federated-learning simulator.

The Paillier implementation performs a real 2048-bit homomorphic sum.  It is
kept deliberately small and dependency-light so it can also be audited in
tests.  Production deployments should place each client and the key holder in
separate trust domains; running them in one process only validates the protocol.
"""
from dataclasses import dataclass
import math
import secrets
from typing import List, Tuple

import numpy as np
from cryptography.hazmat.primitives.asymmetric import rsa


@dataclass(frozen=True)
class PaillierPublicKey:
    n: int
    g: int

    @property
    def n_sq(self) -> int:
        return self.n * self.n

    def encrypt(self, value: int) -> int:
        if not 0 <= value < self.n:
            raise ValueError("Paillier plaintext is outside the valid range")
        while True:
            r = secrets.randbelow(self.n - 1) + 1
            if math.gcd(r, self.n) == 1:
                break
        return (pow(self.g, value, self.n_sq) * pow(r, self.n, self.n_sq)) % self.n_sq


@dataclass(frozen=True)
class PaillierPrivateKey:
    public_key: PaillierPublicKey
    lam: int
    mu: int

    def decrypt(self, ciphertext: int) -> int:
        n = self.public_key.n
        value = (pow(ciphertext, self.lam, n * n) - 1) // n
        return (value * self.mu) % n


def generate_paillier_keypair(bits: int = 2048) -> Tuple[PaillierPublicKey, PaillierPrivateKey]:
    if bits < 2048:
        raise ValueError("Paillier keys must be at least 2048 bits")
    private = rsa.generate_private_key(public_exponent=65537, key_size=bits)
    numbers = private.private_numbers()
    p, q = numbers.p, numbers.q
    n = p * q
    lam = math.lcm(p - 1, q - 1)
    public = PaillierPublicKey(n=n, g=n + 1)
    mu = pow(lam, -1, n)
    return public, PaillierPrivateKey(public, lam, mu)


def paillier_fed_avg(
    client_parameters: List[List[np.ndarray]], client_samples: List[int], bits: int = 2048,
    scale: int = 1_000_000, digit_bits: int = 48,
) -> Tuple[List[np.ndarray], dict]:
    """Return a sample-weighted average computed from encrypted packed values."""
    if not client_parameters or len(client_parameters) != len(client_samples):
        raise ValueError("Client parameters and sample counts must be non-empty and aligned")
    total = sum(client_samples)
    if total <= 0:
        raise ValueError("At least one client sample is required")
    shapes = [layer.shape for layer in client_parameters[0]]
    for parameters in client_parameters:
        if [layer.shape for layer in parameters] != shapes:
            raise ValueError("All clients must use the same model shape")

    public, private = generate_paillier_keypair(bits)
    base = 1 << digit_bits
    offset = base // (2 * len(client_parameters))
    slots = max(1, (public.n.bit_length() - 2) // digit_bits)
    encrypted_clients = []
    total_values = sum(int(np.prod(shape)) for shape in shapes)
    for parameters, samples in zip(client_parameters, client_samples):
        flat = np.concatenate([layer.astype(np.float64, copy=False).ravel() for layer in parameters])
        quantized = np.rint(flat * (samples / total) * scale).astype(object)
        if any(abs(int(value)) >= offset for value in quantized):
            raise OverflowError("A model value is too large for the encrypted fixed-point packing")
        ciphertexts = []
        for start in range(0, len(quantized), slots):
            packed = 0
            for index, value in enumerate(quantized[start:start + slots]):
                packed += (int(value) + offset) * (base ** index)
            ciphertexts.append(public.encrypt(packed))
        encrypted_clients.append(ciphertexts)

    encrypted_sum = []
    for index in range(len(encrypted_clients[0])):
        value = 1
        for client in encrypted_clients:
            value = (value * client[index]) % public.n_sq
        encrypted_sum.append(value)

    decoded = []
    for ciphertext in encrypted_sum:
        packed = private.decrypt(ciphertext)
        for _ in range(min(slots, total_values - len(decoded))):
            decoded.append(((packed % base) - len(client_parameters) * offset) / scale)
            packed //= base
    arrays, cursor = [], 0
    for shape in shapes:
        size = int(np.prod(shape))
        arrays.append(np.asarray(decoded[cursor:cursor + size], dtype=np.float64).reshape(shape))
        cursor += size
    return arrays, {"scheme": "Paillier", "key_bits": bits, "fixed_point_scale": scale,
                    "ciphertext_count": sum(len(items) for items in encrypted_clients),
                    "packed_values": total_values}


def gaussian_zcdp_epsilon(steps: int, noise_multiplier: float, delta: float) -> float:
    """Conservative replace-one Gaussian composition bound via zCDP."""
    if steps < 1 or noise_multiplier <= 0 or not 0 < delta < 1:
        raise ValueError("Invalid differential privacy parameters")
    rho = 2.0 * steps / (noise_multiplier ** 2)
    return rho + 2.0 * math.sqrt(rho * math.log(1.0 / delta))


def noise_multiplier_for_epsilon(target_epsilon: float, steps: int, delta: float) -> float:
    if target_epsilon <= 0 or steps < 1 or not 0 < delta < 1:
        raise ValueError("Invalid differential privacy target")
    root_log = math.sqrt(math.log(1.0 / delta))
    rho = (math.sqrt(root_log * root_log + target_epsilon) - root_log) ** 2
    return math.sqrt(2.0 * steps / rho)
