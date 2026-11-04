"""AFK-Klicker für Path of Titans (Charakterauswahl, 1920x1080).

Klickt die Charakterkarten rechts in der Liste von oben nach unten an,
immer im Kreis, damit du in der Charakterauswahl nicht wegen
Inaktivität rausfliegst. Nur Windows, keine Zusatzpakete nötig.

Tasten (gehen auch, während das Spiel vorne ist):
  F7  Start / Pause. Beim Start merkt sich das Skript das Fenster, das
      gerade vorne ist (das Spiel), und klickt nur, solange es vorne bleibt.
  F6  Eigene Klickpunkte aufnehmen: Maus auf eine Karte, F6 drücken,
      von oben nach unten. Der erste Druck ersetzt die Standardpunkte.
  F9  Zurück zu den Standardpunkten.
  F8  Beenden.

Aufruf:  python tools/afk_klicker.py [--pause 5]
"""

import argparse
import ctypes
import time
from ctypes import wintypes

user32 = ctypes.windll.user32
user32.GetForegroundWindow.restype = wintypes.HWND
user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetAsyncKeyState.restype = ctypes.c_short

BILDSCHIRM = (1920, 1080)

# Textbereich der sechs voll sichtbaren Karten (Tiguan bis Mistral).
# Gustave ist nur halb sichtbar und bleibt draußen, sonst scrollt die Liste.
STANDARD_PUNKTE = [(1540, 137), (1540, 255), (1540, 375), (1540, 495), (1540, 615), (1540, 735)]

# Nur in diesem Rechteck (Charakterliste) wird je geklickt. Enter World,
# Edit, Delete und Logout liegen darunter und sind damit nie erreichbar.
LISTE = (1420, 80, 1890, 790)  # links, oben, rechts, unten

VK_F6, VK_F7, VK_F8, VK_F9 = 0x75, 0x76, 0x77, 0x78

MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.c_size_t),
    ]


class INPUT(ctypes.Structure):
    # Von der Union aus Maus/Tastatur/Hardware reicht der Mausteil, er ist der größte.
    _fields_ = [("type", wintypes.DWORD), ("mi", MOUSEINPUT)]


def dpi_bewusst():
    # Sonst rechnet Windows bei Skalierung (125 %, 150 %) die Koordinaten um.
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except (AttributeError, OSError):
        user32.SetProcessDPIAware()


def maus(flags):
    eingabe = INPUT(type=0, mi=MOUSEINPUT(dwFlags=flags))
    user32.SendInput(1, ctypes.byref(eingabe), ctypes.sizeof(INPUT))


def klick(x, y):
    user32.SetCursorPos(x, y)
    maus(MOUSEEVENTF_MOVE)  # Hover auslösen, Unreal-Menüs reagieren sonst manchmal nicht
    time.sleep(0.08)
    maus(MOUSEEVENTF_LEFTDOWN)
    time.sleep(0.06)
    maus(MOUSEEVENTF_LEFTUP)


def fenstertitel(hwnd):
    puffer = ctypes.create_unicode_buffer(256)
    user32.GetWindowTextW(hwnd, puffer, 256)
    return puffer.value or "(ohne Titel)"


def im_listenbereich(x, y):
    links, oben, rechts, unten = LISTE
    return links <= x <= rechts and oben <= y <= unten


class Tasten:
    """Erkennt einzelne Tastendrücke global, auch wenn das Spiel vorne ist."""

    def __init__(self):
        self.gedrueckt = set()

    def neu(self, vk):
        unten = bool(user32.GetAsyncKeyState(vk) & 0x8000)
        war_unten = vk in self.gedrueckt
        if unten:
            self.gedrueckt.add(vk)
        else:
            self.gedrueckt.discard(vk)
        return unten and not war_unten


def main():
    parser = argparse.ArgumentParser(description="AFK-Klicker für die Path-of-Titans-Charakterauswahl")
    parser.add_argument("--pause", type=float, default=5.0, help="Sekunden zwischen zwei Klicks (Standard 5)")
    args = parser.parse_args()
    if args.pause < 1:
        parser.error("--pause muss mindestens 1 Sekunde sein (zwei schnelle Klicks wären ein Doppelklick)")

    dpi_bewusst()
    aufloesung = (user32.GetSystemMetrics(0), user32.GetSystemMetrics(1))
    if aufloesung != BILDSCHIRM:
        print(f"Bildschirm ist {aufloesung[0]}x{aufloesung[1]}, das Skript ist für 1920x1080 gebaut. Abbruch.")
        return

    punkte = list(STANDARD_PUNKTE)
    eigene = False
    laeuft = False
    wartet = False
    spiel = None
    index = 0
    naechster = 0.0
    tasten = Tasten()

    print("F7 = Start/Pause, F6 = Punkt aufnehmen, F9 = Standardpunkte, F8 = Beenden")
    print(f"{len(punkte)} Standardpunkte geladen, ein Klick alle {args.pause:g} s.")

    while True:
        if tasten.neu(VK_F8):
            print("Beendet.")
            return

        if tasten.neu(VK_F6):
            pos = wintypes.POINT()
            user32.GetCursorPos(ctypes.byref(pos))
            if not im_listenbereich(pos.x, pos.y):
                print(f"({pos.x}, {pos.y}) liegt außerhalb der Charakterliste, nicht übernommen.")
            else:
                if not eigene:
                    punkte, eigene, index = [], True, 0
                punkte.append((pos.x, pos.y))
                print(f"Punkt {len(punkte)}: ({pos.x}, {pos.y})")

        if tasten.neu(VK_F9):
            punkte, eigene, index = list(STANDARD_PUNKTE), False, 0
            print("Zurück auf die Standardpunkte.")

        if tasten.neu(VK_F7):
            laeuft = not laeuft
            if laeuft:
                spiel = user32.GetForegroundWindow()
                index, naechster, wartet = 0, time.monotonic(), False
                print(f"Läuft. Klickt nur, solange „{fenstertitel(spiel)}“ vorne ist.")
            else:
                print("Pause.")

        if laeuft and time.monotonic() >= naechster:
            naechster = time.monotonic() + args.pause
            if user32.GetForegroundWindow() != spiel:
                if not wartet:
                    print("Spiel ist nicht vorne, warte …")
                    wartet = True
            else:
                if wartet:
                    print("Spiel wieder vorne, klicke weiter.")
                    wartet = False
                x, y = punkte[index % len(punkte)]
                klick(x, y)
                index += 1

        time.sleep(0.02)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Beendet.")
