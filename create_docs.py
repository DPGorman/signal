import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build

# 1. Point to the keys we generated
SERVICE_ACCOUNT_FILE = 'credentials.json'
SCOPES = ['https://www.googleapis.com/auth/drive']

# 2. Authenticate the Bot
creds = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
drive_service = build('drive', 'v3', credentials=creds)

# ==========================================
# 3. YOUR CONFIGURATION
# ==========================================
# PASTE YOUR FOLDER ID HERE
FOLDER_ID = 'PASTE_YOUR_FOLDER_ID_HERE' 

# The list of documents you want to generate
doc_names = [
    "Episode 101 - Beat Sheet",
    "Character Dynamics - Kampala",
    "Research - Belt and Road Logistics",
    "Show Bible - Working Draft"
]

# Get today's date in YYYY-MM-DD format
today = datetime.date.today().strftime("%Y-%m-%d")

# ==========================================
# 4. EXECUTE
# ==========================================
def main():
    print(f"Spinning up docs for {today}...")
    
    for name in doc_names:
        full_name = f"{today} - {name}"
        file_metadata = {
            'name': full_name,
            'mimeType': 'application/vnd.google-apps.document',
            'parents': [FOLDER_ID] 
        }
        
        try:
            file = drive_service.files().create(body=file_metadata, fields='id').execute()
            print(f" [+] Created: '{full_name}'")
        except Exception as e:
            print(f" [!] FAILED to create '{full_name}'. Error: {e}")

if __name__ == '__main__':
    main()