// Supabase client configuration for database operations
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase credentials not found. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file');
}

// Create Supabase client for database operations
// Note: For auth operations, use the client/server helpers in lib/supabase/
export const supabase: SupabaseClient | null = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Database helper object that mimics the JSON file-based API
interface QueryObject {
  [key: string]: any;
}

export const db = {
  get: (tableName: string) => {
    return {
      // Find a single record matching query
      find: (query: QueryObject) => ({
        value: async () => {
          if (!supabase) {
            console.error('Supabase client not initialized');
            return null;
          }
          
          try {
            let queryBuilder = supabase.from(tableName).select('*');
            
            // Apply filters from query object
            Object.keys(query).forEach(key => {
              queryBuilder = queryBuilder.eq(key, query[key]);
            });
            
            const { data, error } = await queryBuilder.limit(1).single();
            
            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
              console.error(`Error finding record in ${tableName}:`, error);
              return null;
            }
            
            return data || null;
          } catch (error) {
            console.error(`Error in find for ${tableName}:`, error);
            return null;
          }
        },
        
        // Update a record
        assign: async (updates: QueryObject) => {
          if (!supabase) {
            console.error('Supabase client not initialized');
            return { write: () => {}, value: () => null };
          }
          
          try {
            let queryBuilder = supabase.from(tableName).update(updates);
            
            // Apply filters from query object
            Object.keys(query).forEach(key => {
              queryBuilder = queryBuilder.eq(key, query[key]);
            });
            
            const { data, error } = await queryBuilder.select().single();
            
            if (error) {
              console.error(`Error updating record in ${tableName}:`, error);
              return { write: () => {}, value: () => null };
            }
            
            return {
              write: async () => {},
              value: () => data
            };
          } catch (error) {
            console.error(`Error in assign for ${tableName}:`, error);
            return { write: () => {}, value: () => null };
          }
        },
        
        // Remove a record
        remove: async () => {
          if (!supabase) {
            console.error('Supabase client not initialized');
            return { write: () => {} };
          }
          
          try {
            let queryBuilder = supabase.from(tableName).delete();
            
            // Apply filters from query object
            Object.keys(query).forEach(key => {
              queryBuilder = queryBuilder.eq(key, query[key]);
            });
            
            const { error } = await queryBuilder;
            
            if (error) {
              console.error(`Error deleting record from ${tableName}:`, error);
            }
            
            return { write: async () => {} };
          } catch (error) {
            console.error(`Error in remove for ${tableName}:`, error);
            return { write: () => {} };
          }
        }
      }),
      
      // Filter records
      filter: (query: QueryObject | ((item: any) => boolean)) => ({
        value: async () => {
          if (!supabase) {
            console.error('Supabase client not initialized');
            return [];
          }
          
          try {
            let queryBuilder = supabase.from(tableName).select('*');
            
            if (typeof query === 'function') {
              // For function queries, we need to fetch all and filter in memory
              const { data, error } = await queryBuilder;
              if (error) {
                console.error(`Error filtering ${tableName}:`, error);
                return [];
              }
              return (data || []).filter(query);
            } else {
              // Apply filters from query object
              Object.keys(query).forEach(key => {
                queryBuilder = queryBuilder.eq(key, query[key]);
              });
              
              const { data, error } = await queryBuilder;
              
              if (error) {
                console.error(`Error filtering ${tableName}:`, error);
                return [];
              }
              
              return data || [];
            }
          } catch (error) {
            console.error(`Error in filter for ${tableName}:`, error);
            return [];
          }
        }
      }),
      
      // Add a new record
      push: async (item: any) => {
        if (!supabase) {
          console.error('Supabase client not initialized');
          return { write: () => {}, value: () => [] };
        }
        
        try {
          const { data, error } = await supabase
            .from(tableName)
            .insert(item)
            .select()
            .single();
          
          if (error) {
            console.error(`Error inserting into ${tableName}:`, error);
            return { write: () => {}, value: () => [] };
          }
          
          return {
            write: async () => {},
            value: async () => {
              const { data: allData } = await supabase.from(tableName).select('*');
              return allData || [];
            }
          };
        } catch (error) {
          console.error(`Error in push for ${tableName}:`, error);
          return { write: () => {}, value: () => [] };
        }
      },
      
      // Get all records
      value: async () => {
        if (!supabase) {
          console.error('Supabase client not initialized');
          return [];
        }
        
        try {
          const { data, error } = await supabase.from(tableName).select('*');
          
          if (error) {
            console.error(`Error fetching from ${tableName}:`, error);
            return [];
          }
          
          return data || [];
        } catch (error) {
          console.error(`Error in value for ${tableName}:`, error);
          return [];
        }
      }
    };
  }
};
