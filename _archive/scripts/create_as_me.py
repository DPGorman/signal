import os.path
import datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/drive.file']
FOLDER_ID = '19MoRJSXHzHuhTzp-pCYc-ahKntZUPb-V'

def main():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    service = build('drive', 'v3', credentials=creds)

    # Ask for names in the terminal
    print("\n--- CRISPR Document Generator ---")
    user_input = input("Enter document names separated by commas: ")
    doc_names = [name.strip() for name in user_input.split(',') if name.strip()]
    
    # Get today's date in your requested format
    today_str = datetime.date.today().strftime('%Y-%m-%d')

    print(f"\nCreating {len(doc_names)} docs in folder {FOLDER_ID}...")
    
    for name in doc_names:
        formatted_name = f"{today_str}-{name}"
        file_metadata = {
            'name': formatted_name,
            'mimeType': 'application/vnd.google-apps.document',
            'parents': [FOLDER_ID]
        }
        try:
            file = service.files().create(body=file_metadata, fields='id').execute()
            print(f"  [+] Created: {formatted_name}")
        except Exception as e:
            print(f"  [!] Failed {formatted_name}: {e}")

if __name__ == '__main__':
    main()
