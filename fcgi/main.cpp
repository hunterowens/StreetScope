//==============================================================================
// main.cpp
// Created March 5 2012
//==============================================================================

#include <exception>
#include <iostream>
#include <sstream>

// fcgi Headers
#include <unistd.h>
#include "Cgicc.h"
#include "HTTPHTMLHeader.h"
#include "HTMLClasses.h"
#include "FCgiIO.h"

// Database Headers
#include "Database.h"
#include "DatabaseServer.h"

// WebPage Headers
#include "BasicHTML.h"
//#include "SessionData.h"

using namespace std;
using namespace cgicc;

int main (int /*argc*/, const char** /*argv*/, char** /*envp*/) {

   // fcgi initialization
   FCGX_Request request;
   FCGX_Init();
   FCGX_InitRequest(&request, 0, 0);
   
//   unsigned count = 0;
   
   // Database Initialization
   bool failure = false;
   Database database;
   if (!database.connect()) failure = true;
   //database.setRootDir("/var/www/data/");
   //database.setRootDir("/home/ubuntu/streetview/data/");
   //database.setPanoDir("/var/www/panos/");
   database.setPanoramaDirectory("/home/erik/Code/streetview/panoramas");
   database.ensureIndexes();

   DatabaseServer dbserver(database);
   
   // Session Data Initialization
   //SessionData session(database);
   
   
   while(FCGX_Accept_r(&request) == 0) {
      try {
         FCgiIO IO(request);
         Cgicc CGI(&IO);

         // Find which command is being invoked
         const_form_iterator command = CGI["cmd"];
         if (command == CGI.getElements().end()) {
            // If there's no command, render an eror message.
            printHeader(IO);
            IO << "Error: no command found.\n";
         } else if (strcmp("status", command->getValue().c_str()) == 0) {
            dbserver.status(IO, CGI, failure);
         } else if (strcmp("metadata", command->getValue().c_str()) == 0) {
            dbserver.metadata(IO, CGI);
         } else if (strcmp("panos_near", command->getValue().c_str()) == 0) {
            dbserver.panoramaNear(IO, CGI);
         //} else if (strcmp("panos_in_range", command->getValue().c_str()) == 0) {
         //   dbserver.panosInRange(IO, CGI);
         } else if (strcmp("pano_id_near", command->getValue().c_str()) == 0) {
            dbserver.panoramaByPanoid(IO, CGI);
         } else if (strcmp("download_pano", command->getValue().c_str()) == 0) {
            dbserver.downloadPanorama(IO, CGI);
         /*
         } else if (strcmp("new_tag", command->getValue().c_str()) == 0) {
            dbserver.newTag(IO, CGI);
         } else if (strcmp("remove_tag", command->getValue().c_str()) == 0) {
            dbserver.removeTag(IO, CGI);
         */
         } else {
            // If we haven't found the command yet, it doesn't exist.
            printHeader(IO);
            IO << "Error: command not recognized.\n";
         }
      }
      catch(const exception&) {
         // handle error condition
      }
      
      FCGX_Finish_r(&request);
   }
   
   return 0;
}

