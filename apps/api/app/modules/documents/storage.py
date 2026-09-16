from pathlib import Path
from uuid import uuid4


class DocumentStorage:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, content: bytes) -> str:
        storage_key = str(uuid4())
        target = self.root / storage_key
        target.write_bytes(content)
        return storage_key

    def read(self, storage_key: str) -> bytes:
        target = self.root / storage_key
        if target.parent != self.root or not target.is_file():
            raise FileNotFoundError(storage_key)
        return target.read_bytes()

    def delete(self, storage_key: str) -> None:
        target = self.root / storage_key
        if target.parent == self.root and target.exists():
            target.unlink()
